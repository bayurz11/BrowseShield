"""Render browser icon PNG sizes from the supplied transparent BrowseShield mark."""

from pathlib import Path
import sys

try:
    from PIL import Image
except ImportError:
    print("Pillow is required. Install it with: python -m pip install -r scripts/requirements-icons.txt", file=sys.stderr)
    raise SystemExit(1)


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "scripts" / "assets" / "browseshield-source.png"
OUT = ROOT / "src" / "assets" / "icons"
SIZES = (16, 32, 48, 128)
PADDING_RATIO = 0.92

if not SOURCE.is_file():
    raise SystemExit(f"Icon source not found: {SOURCE}")

with Image.open(SOURCE) as opened:
    artwork = opened.convert("RGBA")
    alpha = artwork.getchannel("A")
    bounds = alpha.point(lambda value: 255 if value > 8 else 0).getbbox()
    if not bounds:
        raise SystemExit("Icon source has no visible artwork")
    artwork = artwork.crop(bounds)

OUT.mkdir(parents=True, exist_ok=True)
for size in SIZES:
    rendered = artwork.copy()
    inner_size = round(size * PADDING_RATIO)
    rendered.thumbnail((inner_size, inner_size), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    left = (size - rendered.width) // 2
    top = (size - rendered.height) // 2
    canvas.alpha_composite(rendered, (left, top))
    output = OUT / f"icon{size}.png"
    canvas.save(output, format="PNG", optimize=True)
    print(f"Created {output.relative_to(ROOT)}")
