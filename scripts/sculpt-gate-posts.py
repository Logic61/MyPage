"""Bake the gate's two chisel-cut surfaces from ZhiMangXing-Regular.ttf.

Run with the font path as the argument. Requires Pillow, NumPy, OpenCV and SciPy.
The mesh uses unrolled pillar coordinates so the renderer can taper it to the post.
"""
import json
from pathlib import Path
import sys

import cv2
import numpy as np
from PIL import Image, ImageDraw, ImageFilter, ImageFont
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
    field = np.clip((distance - 1) / 11, 0, 1)
    # Refine chords that bridge counters or adjacent strokes, using the original glyph as reference.
    for iteration in range(6):
        mesh = Delaunay(points)
        depth = field[points[:, 1], points[:, 0]]
        if iteration == 5:
            break
        tri = mesh.simplices
        probes = []
        for weights in ((1/3, 1/3, 1/3), (.5, .5, 0), (.5, 0, .5), (0, .5, .5)):
            xy = np.rint(np.einsum("ijk,j->ik", points[tri], weights)).astype(int)
            error = np.abs(depth[tri] @ weights - field[xy[:, 1], xy[:, 0]])
            probes.extend(xy[error > .19])
        if not probes:
            break
        points = np.unique(np.vstack((points, probes)), axis=0)
    vertices = np.column_stack((points, np.round(depth * 255).astype(int)))
    triangles = mesh.simplices[:, ::-1]  # image Y grows downward
    light = np.asarray(mask) * (.78 + .22 * field)
    return ({"vertices": vertices.ravel().tolist(), "indices": triangles.ravel().tolist()},
            Image.fromarray(light.astype("uint8")).crop((453, 0, 741, 2111)))


def nameboard(title, font_path, output, width):
    height = 320
    y, x = np.mgrid[:height, :width]
    patina = .5 + .28 * np.cos((x / width - .5) * np.pi) + .16 * np.sin(y / height * np.pi)
    base = np.array([15, 31, 29]) + patina[..., None] * [13, 18, 15]
    board = Image.fromarray(base.astype("uint8"))
    draw = ImageDraw.Draw(board)
    for inset, colour, weight in ((8, "#ad8351", 3), (16, "#70573b", 2)):
        draw.rectangle((inset, inset, width-1-inset, height-1-inset), outline=colour, width=weight)
    # Mirrored stepped key-fret corners, linked to the inner fillet.
    for sx in (-1, 1):
        for sy in (-1, 1):
            ox, oy = (width-1 if sx < 0 else 0), (height-1 if sy < 0 else 0)
            corner = [(16,53),(41,53),(41,31),(31,31),(31,42),(56,42),(56,24),(92,24)]
            draw.line([(ox+sx*a, oy+sy*b) for a,b in corner], fill="#ba9861", width=3)
    ink = Image.new("L", board.size)
    font = ImageFont.truetype(font_path, 232)
    advance = 240
    for i, c in enumerate(title):
        left, top, right, bottom = font.getbbox(c)
        cx = width/2 + (i - (len(title)-1)/2) * advance
        ImageDraw.Draw(ink).text((cx-(left+right)/2, height/2-(top+bottom)/2), c, font=font, fill=255)
    shadow = Image.new("L", board.size)
    shadow.paste(ink, (1, 3))
    board.paste("#171b17", mask=shadow.filter(ImageFilter.GaussianBlur(1)))
    gold = np.array([228, 197, 130]) - (y/height)[..., None] * [37, 37, 24]
    board.paste(Image.fromarray(gold.astype("uint8")), mask=ink)
    board.save(output, quality=93, method=6)


if __name__ == "__main__":
    font = ImageFont.truetype(sys.argv[1], 232)
    root = Path(__file__).resolve().parents[1]
    posts = {}
    atlas = Image.new("L", (576, 2111))
    for column, line in enumerate(("青山流云皆入境", "旧忆新知尽成篇")):
        posts[line], light = sculpt(line, font)
        atlas.paste(light, (column * 288, 0))
    art = root / "public/world"
    atlas.save(art / "gate-stroke-light.webp", lossless=True, method=6)
    nameboard("留云阁", sys.argv[1], art / "cloudrest-nameboard.webp", 1160)
    nameboard("摘星留云", sys.argv[1], art / "star-hall-nameboard.webp", 1360)
    out = root / "src/assets/gate-posts.json"
    out.write_text(json.dumps(posts, ensure_ascii=False, separators=(",", ":")) + "\n", encoding="utf8")
