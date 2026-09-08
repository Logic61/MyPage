"""把 markdown 里的 `![](/images/Pasted_image_X.png)` 改成相对路径 `![](../离散/images/Pasted_image_X.png)`。

依赖：所有被引用的图片都集中在 src/content/blog/离散/images/。
"""
import os
import re
import glob

BLOG_ROOT = r"C:\Users\32372\MyPage\src\content\blog"
TARGET_DIR = os.path.join(BLOG_ROOT, "离散", "images")
PATTERN = re.compile(r'!\[\]\(/images/(Pasted_image_[^)]+)\)')

updated = 0
for md in glob.glob(os.path.join(BLOG_ROOT, "**", "*.md"), recursive=True):
    with open(md, "r", encoding="utf-8") as f:
        content = f.read()
    if "/images/Pasted_image_" not in content:
        continue

    md_dir = os.path.dirname(md)
    rel = os.path.relpath(TARGET_DIR, md_dir).replace(os.sep, "/")

    new = PATTERN.sub(lambda m: f"![]({rel}/{m.group(1)})", content)
    if new != content:
        with open(md, "w", encoding="utf-8") as f:
            f.write(new)
        rel_md = os.path.relpath(md, BLOG_ROOT)
        print(f"  {rel_md}  -> prefix {rel}/")
        updated += 1

print(f"\nupdated {updated} files")
