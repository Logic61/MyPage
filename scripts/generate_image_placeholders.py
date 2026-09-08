"""为缺失的 Pasted_image_*.png 生成 1x1 透明占位符，构建期引用不会报错。"""
import os
import glob
import re
from PIL import Image, ImageDraw, ImageFont

BLOG_ROOT = r"C:\Users\32372\MyPage\src\content\blog"
IMG_DIR = os.path.join(BLOG_ROOT, "离散", "images")

# 找出所有 markdown 引用过的 Pasted_image_*.png
referenced = set()
for md in glob.glob(os.path.join(BLOG_ROOT, "**", "*.md"), recursive=True):
    with open(md, "r", encoding="utf-8") as f:
        for m in re.finditer(r'Pasted_image_[^)\s]+\.png', f.read()):
            referenced.add(m.group(0))

existing = {f for f in os.listdir(IMG_DIR) if f.startswith("Pasted_image_")}
missing = sorted(referenced - existing)

if not missing:
    print("没有缺失，无需生成占位符")
else:
    # 生成一个柔和灰色 "missing" 占位图，宽 600 高 80，中文+文件名
    img = Image.new("RGB", (600, 80), color=(245, 245, 245))
    draw = ImageDraw.Draw(img)
    # 边框
    draw.rectangle([(0, 0), (599, 79)], outline=(200, 200, 200), width=1)
    # 找可用中文字体
    font = None
    for fp in [
        r"C:\Windows\Fonts\msyh.ttc",
        r"C:\Windows\Fonts\simhei.ttf",
        r"C:\Windows\Fonts\msyh.ttf",
    ]:
        if os.path.exists(fp):
            try:
                font = ImageFont.truetype(fp, 16)
                break
            except Exception:
                pass
    if font is None:
        font = ImageFont.load_default()

    for fname in missing:
        text = f"待补图: {fname}"
        path = os.path.join(IMG_DIR, fname)
        # 文本居中
        bbox = draw.textbbox((0, 0), text, font=font)
        tw, th = bbox[2] - bbox[0], bbox[3] - bbox[1]
        x = (600 - tw) // 2
        y = (80 - th) // 2
        draw.text((x, y), text, fill=(120, 120, 120), font=font)
        img.save(path, "PNG")
        print(f"  generated {fname}")
        # 重新填充背景给下一张
        draw.rectangle([(0, 0), (599, 79)], fill=(245, 245, 245))
        draw.rectangle([(0, 0), (599, 79)], outline=(200, 200, 200), width=1)

    print(f"\n共生成 {len(missing)} 个占位图到 {IMG_DIR}")
