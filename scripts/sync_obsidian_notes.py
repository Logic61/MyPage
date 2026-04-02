import os
import glob
import re
import shutil
from datetime import datetime

# 定义源目录和目标目录
SOURCE_BASE = r"C:\Users\32372\myBlog\source\_posts"
DEST_BASE = r"C:\Users\32372\MyPage\src\content\blog"

# 需要同步的分类目录
CATEGORIES = ["离散", "数学随笔", "线代", "高数"]

def process_content(content, filename, category, filepath):
    """
    处理 Markdown 的 Frontmatter 和 排版正文
    """
    # 提取顶部的 yaml
    match = re.match(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
    metadata = {}
    body = content
    if match:
        fm_text = match.group(1)
        body = match.group(2)
        for line in fm_text.split('\n'):
            if ':' in line:
                k, v = line.split(':', 1)
                metadata[k.strip()] = v.strip().strip('"').strip("'")

    # ==================
    # 1. 格式化正文排版（沿用之前的逻辑）
    # ==================
    # 删去 $$ 公式两侧的 <p>
    body = re.sub(r'<p>\s*(\$\$.*?\$\$)\s*</p>', r'\1', body, flags=re.DOTALL)
    
    # 删去 > 后面的 ![]() 
    body = re.sub(r'>\s*!\[.*?\]\(.*?\)[ \t]*\n', r'> \n', body)
    body = re.sub(r'>\s*!\[.*?\]\(.*?\)', r'> ', body)
    
    # 行内公式两边加空格
    body = re.sub(r'([A-Za-z0-9\u4e00-\u9fa5])\$(?!\$)', r'\1 $', body)   
    body = re.sub(r'(?<!\$)\$([A-Za-z0-9\u4e00-\u9fa5])', r'$ \1', body)

    # ==================
    # 2. 生成完全兼容 Astro 的 Frontmatter
    # ==================
    title = metadata.get('title') or metadata.get('Title') or filename.replace('.md', '')
    
    # 日期生成 fallback: 使用原有日期或提取文件创建时间记录
    pubDate = str(metadata.get('pubDate') or metadata.get('date') or '')
    pubDate = pubDate.strip().strip('"').strip("'")
    pubDate = pubDate.replace('/', '-')
    if pubDate and len(pubDate) >= 10:
        pubDate = pubDate[:10] # 只保留 YYYY-MM-DD
    
    # 尝试自动补齐 YYYY-M-D 变为 YYYY-MM-DD
    parts = pubDate.split('-')
    if len(parts) >= 3:
        pubDate = f"{parts[0]}-{parts[1].zfill(2)}-{parts[2][:2].zfill(2)}"
        
    if not pubDate or len(pubDate) < 10:
        mtime = os.path.getmtime(filepath)
        pubDate = datetime.fromtimestamp(mtime).strftime('%Y-%m-%d')

    # 获取或自动生成 description 描述
    description = metadata.get('description')
    if not description:
        # 去掉 markdown 格式和换行
        clean_text = re.sub(r'[#>\*\-\[\]\$\r\n]+', ' ', body)
        clean_text = re.sub(r'\s+', ' ', clean_text).strip()
        description = clean_text[:90] + '...' if len(clean_text) > 90 else clean_text
        if not description:
            description = title
    
    # 规整 tags (如果旧版里已经有了 tag 结构)
    tags_str = metadata.get('tags', '')
    tags_list = [category]
    if tags_str:
        if tags_str.startswith('['):
            tags_str = tags_str.strip('[]')
            tags_list.extend([t.strip().strip("'").strip('"') for t in tags_str.split(',')])
        else:
            tags_list.append(tags_str)
            
    # Tag 滤除重复与空字符串打包
    tags_list = list(set(t for t in tags_list if t))
    tags_formatted = '[' + ', '.join([f"'{t}'" for t in tags_list]) + ']'
    
    # 安全转义: 干掉引号和反斜杠（防止导致 yaml escape 报错）
    description = description.replace('"', '').replace("'", "").replace("\\", " ")
    title = title.replace('"', '').replace("'", "").replace("\\", " ")

    # 拼装回完整的兼容文件
    new_content = f"""---
title: "{title}"
description: "{description}"
pubDate: {pubDate}
category: "{category}"
tags: {tags_formatted}
---

{body}"""
    
    return new_content

def sync_and_format():
    for category in CATEGORIES:
        src_dir = os.path.join(SOURCE_BASE, category)
        dest_dir = os.path.join(DEST_BASE, category)
        
        # 检查源目录是否存在
        if not os.path.exists(src_dir):
            print(f"跳过: 源目录不存在或未创建 - {src_dir}")
            continue
            
        # 确保目标目录存在
        os.makedirs(dest_dir, exist_ok=True)
        
        # 查找所有 .md 文件
        md_files = glob.glob(os.path.join(src_dir, "*.md"))
        if not md_files:
            print(f"提示: 在 {src_dir} 中没有找到 Markdown 文件")
            continue
            
        # 同步 Markdown 文件并处理内容格式
        for src_file in md_files:
            filename = os.path.basename(src_file)
            dest_file = os.path.join(dest_dir, filename)
            
            try:
                with open(src_file, 'r', encoding='utf-8') as f:
                    content = f.read()
                    
                # 应用所有兼容性和排版规则！
                formatted_content = process_content(content, filename, category, src_file)
                
                with open(dest_file, 'w', encoding='utf-8') as f:
                    f.write(formatted_content)
                    
                print(f"✅ 已同步并格式化: {category}/{filename}")
            except Exception as e:
                print(f"❌ 处理文件时出错 {src_file}: {e}")
                
        # (可选) 如果你的 Obsidian 里有附带的 images 文件夹，也会一并同步过来
        src_img_dir = os.path.join(src_dir, "images")
        dest_img_dir = os.path.join(dest_dir, "images")
        if os.path.exists(src_img_dir):
            os.makedirs(dest_img_dir, exist_ok=True)
            for img_file in glob.glob(os.path.join(src_img_dir, "*")):
                if os.path.isfile(img_file):
                    shutil.copy2(img_file, dest_img_dir)
            print(f"🖼️ 已同步 {category} 的附带图片")

if __name__ == "__main__":
    print("开始同步、格式化和修复 YAML 笔记...")
    sync_and_format()
    print("同步完成！")
