"""Rebuild the website's WebP derivatives without modifying source images.

Requires Pillow (``python -m pip install Pillow``).
Run from any directory: ``python tools/optimize_images.py``.
"""

import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parents[1]
OUTPUT = ROOT / "assets" / "images"


def export(source, filename, bounds, quality):
    with Image.open(ROOT / source) as original:
        image = ImageOps.exif_transpose(original)
        if image.mode not in ("RGB", "RGBA"):
            image = image.convert("RGBA" if "transparency" in image.info else "RGB")
        image.thumbnail(bounds, Image.Resampling.LANCZOS)
        destination = OUTPUT / filename
        image.save(destination, "WEBP", quality=quality, method=6)
        return {
            "source": source,
            "file": destination.relative_to(ROOT).as_posix(),
            "width": image.width,
            "height": image.height,
            "bytes": destination.stat().st_size,
        }


def main():
    OUTPUT.mkdir(parents=True, exist_ok=True)
    manifest = []
    for width in (480, 800, 1200):
        manifest.append(export("motherchild.png", f"motherchild-{width}.webp", (width, width), 84))
    for name in ("guna", "liga", "meldra"):
        manifest.append(export(f"{name}.png", f"{name}-300.webp", (300, 300), 85))
    for number in range(1, 11):
        source = f"gallery/IMG-20250612-WA{number:04d}.jpg"
        manifest.append(export(source, f"gallery-{number:02d}-thumb.webp", (480, 480), 80))
        manifest.append(export(source, f"gallery-{number:02d}.webp", (1200, 1200), 84))
    (OUTPUT / "manifest.json").write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    main()
