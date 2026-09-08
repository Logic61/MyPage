"""列出所有 markdown 引用但磁盘上不存在的 Pasted_image_*.png"""
import os
import re
import glob

BLOG_ROOT = r"C:\Users\32372\MyPage\src\content\blog"
IMG_DIR = os.path.join(BLOG_ROOT, "离散", "images")
PATTERN = re.compile(r'!\[\]\(([^)]+)\)')

existing = {f for f in os.listdir(IMG_DIR) if f.startswith("Pasted_image_")}
referenced = {}

for md in glob.glob(os.path.join(BLOG_ROOT, "**", "*.md"), recursive=True):
    with open(md, "r", encoding="utf-8") as f:
        content = f.read()
    for m in PATTERN.finditer(content):
        url = m.group(1)
        if "Pasted_image_" not in url:
            continue
        fname = os.path.basename(url)
        referenced.setdefault(fname, []).append(os.path.relpath(md, BLOG_ROOT))

missing = sorted(set(referenced) - existing)
print(f"已存在: {len(existing)}")
print(f"被引用: {len(referenced)}")
print(f"缺失: {len(missing)}")
print()
for f in missing:
    print(f"  {f}  (引用自: {', '.join(referenced[f][:2])}{'...' if len(referenced[f]) > 2 else ''})")
