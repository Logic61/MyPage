import json
import glob
import os
import shutil
import re
from urllib.parse import unquote

# 这是一个用于从VS Code缓存中恢复意外丢失、被清空的Markdown文件的脚本保留备份。
# 它通过读取 `%APPDATA%\Code\User\History` 内的 entries.json 来追溯历史版本。

def recover_markdown_files(target_folder, keywords):
    """
    target_folder: 'src/content/blog/线代'
    keywords: ['笔记1.多项式环.md', '笔记2.环论初探.md']
    """
    history_dir = os.path.expandvars(r'%APPDATA%\Code\User\History')
    entries_files = glob.glob(os.path.join(history_dir, '*', 'entries.json'))
    os.makedirs(target_folder, exist_ok=True)

    for entries_file in entries_files:
        try:
            with open(entries_file, 'r', encoding='utf-8') as f:
                data = json.load(f)
            
            resource = unquote(data.get('resource', ''))
            
            # 看文件名是否在关键词列表中
            if any(k in resource for k in keywords):
                filename = resource.split('/')[-1]
                dest_path = os.path.join(target_folder, filename)

                folder = os.path.dirname(entries_file)
                best_file = None

                # 倒序查找，找到最新且非空（大于200字节）的缓存备份
                for entry in reversed(data.get('entries', [])):
                    entry_id = entry.get('id')
                    candidate = os.path.join(folder, entry_id)
                    if os.path.exists(candidate) and os.path.getsize(candidate) > 200:
                        best_file = candidate
                        break

                if best_file:
                    print(f"Restoring {filename} from {best_file}")
                    # 进行安全的UTF-8读取与复制
                    with open(best_file, 'r', encoding='utf-8') as src:
                        content = src.read()
                    with open(dest_path, 'w', encoding='utf-8') as out:
                        out.write(content)
                    print(f"Successfully restored {filename}")

        except Exception as e:
            pass

if __name__ == "__main__":
    # 使用示例，可以直接修改这几个值以复用
    # recover_markdown_files('src/content/blog/线代', ['笔记1.多项式环.md'])
    print("Restore script ready. Edit the target folder inside the script to use it.")
