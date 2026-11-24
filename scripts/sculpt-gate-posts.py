"""Bake the gate's two chisel-cut surfaces from ZhiMangXing-Regular.ttf.

Run with the font path as the argument. Requires Pillow, NumPy, OpenCV and SciPy.
The mesh uses unrolled pillar coordinates so the renderer can taper it to the post.
"""
import json
from pathlib import Path
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFont
from scipy.spatial import Delaunay


def sculpt(line, font):
    # Work in millimetres on an unrolled cylinder, with the seam at the back.
    width, height = 1194, 2110
    mask = Image.new("L", (width + 1, height + 1))
    for row, char in enumerate(line):
        x0, y0, x1, y1 = font.getbbox(char)
        glyph = Image.new("L", (x1 - x0, y1 - y0))
        ImageDraw.Draw(glyph).text((-x0, -y0), char, font=font, fill=255)
        glyph = glyph.crop(glyph.getbbox())
        glyph.thumbnail((230, 195), Image.Resampling.LANCZOS)
        mask.paste(glyph, ((width - glyph.width) // 2, 445 + row * 225 - glyph.height // 2))

    inside = (np.asarray(mask) >= 128).astype("uint8")
    distance = cv2.distanceTransform(inside, cv2.DIST_L2, 5)
    points = set()
    # Even spacing controls the round silhouette. Only the strokes need fine triangles.
    for y in range(0, height + 1, 211):
        for x in np.linspace(0, width, 49).round().astype(int):
            points.add((int(x), y))
    for inset in (0, 2, 5, 10):
        contours, _ = cv2.findContours((distance > inset).astype("uint8"),
                                       cv2.RETR_LIST, cv2.CHAIN_APPROX_SIMPLE)
        for contour in contours:
            for x, y in cv2.approxPolyDP(contour, 1.2, True).reshape(-1, 2):
                points.add((int(x), int(y)))
    # Fine hairlines can be narrower than the next contour. Sample their centres too.
    crests = (distance >= cv2.dilate(distance, np.ones((3, 3), np.uint8))) & (distance > 1)
    for y, x in np.argwhere(crests):
        if x % 3 == 0 or y % 3 == 0:
            points.add((int(x), int(y)))
    points = np.asarray(sorted(points), dtype=int)
    # A V-cut is deepest at the centre of each stroke. The cut tapers out at the tips.
    depth = np.clip((distance[points[:, 1], points[:, 0]] - 1) / 11, 0, 1)
    vertices = np.column_stack((points, np.round(depth * 255).astype(int)))
    triangles = Delaunay(points).simplices[:, ::-1]  # image Y grows downward
    return {"vertices": vertices.ravel().tolist(), "indices": triangles.ravel().tolist()}


if __name__ == "__main__":
    font = ImageFont.truetype(sys.argv[1], 232)
    posts = {line: sculpt(line, font) for line in ("青山流云皆入境", "旧忆新知尽成篇")}
    out = Path(__file__).resolve().parents[1] / "src/assets/gate-posts.json"
    out.write_text(json.dumps(posts, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")
