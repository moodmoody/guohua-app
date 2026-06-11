from __future__ import annotations

import math
import random
import shutil
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path(sys.argv[1]) if len(sys.argv) > 1 else Path(r"D:\国画.webp")
ASSET_DIR = ROOT / "public" / "assets"
SOURCE_COPY = ASSET_DIR / "guohua-logo-source.webp"
APP_ICON = ASSET_DIR / "app-icon.png"
ANDROID_RES = ROOT / "android" / "app" / "src" / "main" / "res"


def make_paper(size: int) -> Image.Image:
    random.seed(1024)
    base = Image.new("RGBA", (size, size), (250, 247, 239, 255))
    pixels = base.load()
    for y in range(size):
        for x in range(size):
            warm = int(12 * ((x + y) / (size * 2)))
            noise = random.randint(-5, 5)
            pixels[x, y] = (
                max(0, min(255, 250 + noise - warm)),
                max(0, min(255, 247 + noise - warm)),
                max(0, min(255, 239 + noise - warm * 2)),
                255,
            )

    fibers = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fibers)
    for _ in range(size // 3):
        x = random.randint(0, size)
        y = random.randint(0, size)
        length = random.randint(size // 12, size // 4)
        drift = random.randint(-size // 48, size // 48)
        color = random.choice(
            [
                (184, 166, 128, 22),
                (255, 255, 250, 38),
                (206, 190, 154, 18),
            ]
        )
        draw.line((x, y, x + length, y + drift), fill=color, width=1)

    return Image.alpha_composite(base, fibers.filter(ImageFilter.GaussianBlur(0.25)))


def rounded_mask(size: int, radius: int) -> Image.Image:
    mask = Image.new("L", (size, size), 0)
    draw = ImageDraw.Draw(mask)
    draw.rounded_rectangle((0, 0, size - 1, size - 1), radius=radius, fill=255)
    return mask


def replace_background_with_paper(source: Image.Image, size: int = 512) -> Image.Image:
    icon = source.convert("RGBA")
    icon.thumbnail((size, size), Image.Resampling.LANCZOS)

    canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    canvas.alpha_composite(icon, ((size - icon.width) // 2, (size - icon.height) // 2))

    paper = make_paper(size)
    src = canvas.load()
    dst = paper.load()
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out_px = out.load()

    for y in range(size):
        for x in range(size):
            r, g, b, a = src[x, y]
            if a == 0:
                out_px[x, y] = dst[x, y]
                continue

            brightness = (r + g + b) / 3
            saturation = max(r, g, b) - min(r, g, b)
            is_background = brightness > 205 and saturation < 42
            if is_background:
                # Keep the source image's subtle shading while replacing flat white with paper.
                shade = (brightness - 205) / 50
                pr, pg, pb, pa = dst[x, y]
                out_px[x, y] = (
                    int(pr * 0.92 + r * 0.08 + shade * 8),
                    int(pg * 0.92 + g * 0.08 + shade * 8),
                    int(pb * 0.92 + b * 0.08 + shade * 5),
                    255,
                )
            else:
                out_px[x, y] = (r, g, b, a)

    mask = rounded_mask(size, int(size * 0.205))
    out.putalpha(mask)
    return out


def save_resized(icon: Image.Image, path: Path, size: int, *, foreground: bool = False, round_icon: bool = False) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    if foreground:
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        inner = int(size * 0.74)
        resized = icon.resize((inner, inner), Image.Resampling.LANCZOS)
        canvas.alpha_composite(resized, ((size - inner) // 2, (size - inner) // 2))
        canvas.save(path)
        return

    resized = icon.resize((size, size), Image.Resampling.LANCZOS)
    if round_icon:
        mask = Image.new("L", (size, size), 0)
        draw = ImageDraw.Draw(mask)
        draw.ellipse((0, 0, size - 1, size - 1), fill=255)
        resized.putalpha(mask)
    resized.save(path)


def main() -> None:
    if not SOURCE.exists():
        raise SystemExit(f"Source image not found: {SOURCE}")

    ASSET_DIR.mkdir(parents=True, exist_ok=True)
    shutil.copyfile(SOURCE, SOURCE_COPY)

    source = Image.open(SOURCE)
    icon = replace_background_with_paper(source, 512)
    icon.save(APP_ICON)

    densities = {
        "mdpi": (48, 108),
        "hdpi": (72, 162),
        "xhdpi": (96, 216),
        "xxhdpi": (144, 324),
        "xxxhdpi": (192, 432),
    }

    for density, (launcher_size, foreground_size) in densities.items():
        directory = ANDROID_RES / f"mipmap-{density}"
        save_resized(icon, directory / "ic_launcher.png", launcher_size)
        save_resized(icon, directory / "ic_launcher_round.png", launcher_size, round_icon=True)
        save_resized(icon, directory / "ic_launcher_foreground.png", foreground_size, foreground=True)

    print(f"Generated icons from {SOURCE}")


if __name__ == "__main__":
    main()
