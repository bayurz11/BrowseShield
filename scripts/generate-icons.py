"""Render the small BrowseShield SVG mark into manifest-ready PNG icons.

Uses only Python's standard library so icon assets can be regenerated without
installing an image-processing dependency.
"""

from math import hypot
from pathlib import Path
import struct
import zlib

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / "src" / "assets" / "icons"
BASE = 128
SCALE = 4


def inside_polygon(x, y, points):
    inside = False
    previous = points[-1]
    for current in points:
        x1, y1 = previous
        x2, y2 = current
        if (y1 > y) != (y2 > y):
            crossing_x = (x2 - x1) * (y - y1) / (y2 - y1) + x1
            if x < crossing_x:
                inside = not inside
        previous = current
    return inside


def segment_distance(x, y, start, end):
    dx, dy = end[0] - start[0], end[1] - start[1]
    length_squared = dx * dx + dy * dy
    if not length_squared:
        return hypot(x - start[0], y - start[1])
    t = max(0, min(1, ((x - start[0]) * dx + (y - start[1]) * dy) / length_squared))
    return hypot(x - start[0] - t * dx, y - start[1] - t * dy)


def blend(dst, src):
    alpha = src[3] / 255
    inverse = 1 - alpha
    return tuple(round(src[i] * alpha + dst[i] * inverse) for i in range(3)) + (255,)


def rounded_rect_contains(x, y, size, radius):
    cx = min(max(x, radius), size - radius)
    cy = min(max(y, radius), size - radius)
    return (x - cx) ** 2 + (y - cy) ** 2 <= radius ** 2


def render():
    width = BASE * SCALE
    pixels = bytearray(width * width * 4)
    outer = [(64, 17), (99, 31), (99, 55), (95, 70), (88, 83), (78, 95), (64, 112), (50, 95), (40, 83), (33, 70), (29, 55), (29, 31)]
    inner = [(64, 26), (90, 36), (90, 55), (87, 68), (81, 79), (73, 89), (64, 99), (55, 89), (47, 79), (41, 68), (38, 55), (38, 36)]
    check = [((48, 62), (59, 73)), ((59, 73), (81, 50))]

    for py in range(width):
        y = (py + 0.5) / SCALE
        for px in range(width):
            x = (px + 0.5) / SCALE
            if rounded_rect_contains(x, y, BASE, 30):
                t = max(0, min(1, (x + y - 20) / 216))
                start, end = (20, 184, 166), (7, 94, 99)
                pixel = tuple(round(start[i] * (1 - t) + end[i] * t) for i in range(3)) + (255,)
            else:
                pixel = (0, 0, 0, 0)

            if inside_polygon(x, y, outer):
                pixel = blend(pixel, (240, 253, 250, 255))
            if inside_polygon(x, y, inner):
                pixel = blend(pixel, (8, 127, 120, 255))
            if any(segment_distance(x, y, a, b) <= 4 for a, b in check):
                pixel = blend(pixel, (236, 253, 245, 255))
            index = (py * width + px) * 4
            pixels[index:index + 4] = bytes(pixel)
    return width, pixels


def downsample(width, pixels, target):
    scale = width // target
    output = bytearray(target * target * 4)
    samples = scale * scale
    for y in range(target):
        for x in range(target):
            totals = [0, 0, 0, 0]
            for sy in range(y * scale, (y + 1) * scale):
                for sx in range(x * scale, (x + 1) * scale):
                    i = (sy * width + sx) * 4
                    for channel in range(4):
                        totals[channel] += pixels[i + channel]
            i = (y * target + x) * 4
            output[i:i + 4] = bytes(round(value / samples) for value in totals)
    return output


def png_chunk(kind, data):
    checksum = zlib.crc32(kind + data) & 0xFFFFFFFF
    return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", checksum)


def write_png(path, size, rgba):
    rows = b"".join(b"\x00" + rgba[y * size * 4:(y + 1) * size * 4] for y in range(size))
    header = struct.pack(">2I5B", size, size, 8, 6, 0, 0, 0)
    data = b"\x89PNG\r\n\x1a\n" + png_chunk(b"IHDR", header) + png_chunk(b"IDAT", zlib.compress(rows, 9)) + png_chunk(b"IEND", b"")
    path.write_bytes(data)


OUT.mkdir(parents=True, exist_ok=True)
source_width, source_pixels = render()
for icon_size in (16, 32, 48, 128):
    write_png(OUT / f"icon{icon_size}.png", icon_size, downsample(source_width, source_pixels, icon_size))
    print(f"Created {OUT / f'icon{icon_size}.png'}")
