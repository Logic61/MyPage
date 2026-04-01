import glob
import os
import re

files = glob.glob('src/content/blog/离散/*.md')

for filepath in files:
    filename = os.path.basename(filepath)
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()

    # We want to ensure title is clean: "离散笔记1：数论"
    old_title = None
    
    match = re.search(r'^---\s*\n(.*?)\n---\s*\n(.*)', content, re.DOTALL)
    if not match:
        continue
    
    frontmatter, body = match.groups()
    lines = frontmatter.strip().split('\n')
    
    fm_dict = {}
    current_key = None
    for line in lines:
        line = line.strip()
        if not line:
            continue
        if ':' in line and not line.startswith('- '):
            k, v = line.split(':', 1)
            k = k.strip()
            v = v.strip()
            if v.startswith('"') and v.endswith('"'):
                v = v[1:-1]
            elif v.startswith("'") and v.endswith("'"):
                v = v[1:-1]
            fm_dict[k] = v
            current_key = k
        elif line.startswith('- ') and current_key:
            val = line[2:].strip()
            if isinstance(fm_dict[current_key], list):
                fm_dict[current_key].append(val)
            else:
                if fm_dict[current_key] == '':
                    fm_dict[current_key] = [val]
                else:
                    fm_dict[current_key] = [fm_dict[current_key], val]
    
    # 修正 title
    title = fm_dict.get('title', '')
    
    if "离散笔记：" in title or "离散笔记" in title:
        # It's already somewhat processed but might be duplicated like "离散笔记：离散笔记1：数论"
        title = title.replace("离散笔记：离散笔记：", "离散笔记：")
        title = title.replace("离散笔记：离散笔记", "离散笔记")
        
        # fix format "离散笔记：1.数论" -> "离散笔记1：数论"
        m = re.match(r'离散笔记：?(\d+)[\.：_]?\s*(.*)', title)
        if m:
            num, topic = m.groups()
            title = f"离散笔记{num}：{topic}"
    else:
        # Not processed
        m = re.match(r'^(\d+)[\.：_]?\s*(.*)', title)
        if m:
            num, topic = m.groups()
            title = f"离散笔记{num}：{topic}"
        else:
            title = f"离散笔记：{title}"
            
    fm_dict['title'] = f'"{title}"'
    
    # 修正 pubDate
    date_val = fm_dict.get('pubDate', fm_dict.get('date', '2026-03-31'))
    date_val = date_val.split(' ')[0].replace('/', '-')
    fm_dict['pubDate'] = str(date_val)
    if 'date' in fm_dict:
        del fm_dict['date']
        
    # category
    fm_dict['category'] = '离散'
    if 'categories' in fm_dict:
        del fm_dict['categories']
        
    # tags
    t = fm_dict.get('tags', '["数学"]')
    if not isinstance(t, list) and not t.startswith('['):
        fm_dict['tags'] = f'["{t}"]'
    elif isinstance(t, list):
        fm_dict['tags'] = '[' + ', '.join([f'"{x}"' for x in t]) + ']'
        
    # description
    desc = fm_dict.get('description', '')
    if not desc or "离散数学相关笔记" in desc:
        desc = "离散数学相关笔记与整理。"
        desc_match = re.search(r'^(.*?)(?:<!-- more -->)', body, re.DOTALL)
        if desc_match:
            extracted = desc_match.group(1).strip()
            extracted = re.sub(r'#.*?\n', '', extracted)
            extracted = re.sub(r'\n+', ' ', extracted)
            if extracted:
                desc = extracted
        fm_dict['description'] = f'"{desc}"'
    elif desc:
        fm_dict['description'] = f'"{desc}"'
    
    new_lines = []
    order = ['title', 'description', 'pubDate', 'category', 'pinned', 'tags']
    for k in order:
        if k in fm_dict:
            new_lines.append(f"{k}: {fm_dict[k]}")
    for k, v in fm_dict.items():
        if k not in order:
            new_lines.append(f"{k}: {v}")
            
    new_fm = "\n".join(new_lines)
    new_content = f"---\n{new_fm}\n---\n\n{body.lstrip()}"
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print(f"Standardized {filename} to {title}")
