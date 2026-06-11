# -*- coding: utf-8 -*-
from __future__ import annotations

import random
import textwrap
from pathlib import Path

from PIL import Image, ImageDraw, ImageFilter, ImageFont


ROOT = Path(__file__).resolve().parents[1]
ASSET_DIR = ROOT / "public" / "assets"
LOGO_PATH = ASSET_DIR / "app-icon.png"
OUTPUT_PATH = ASSET_DIR / "guohua-app-poster.png"

WIDTH = 1080
HEIGHT = 1440


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


FONT_XINGKAI = r"C:\Windows\Fonts\STXINGKA.TTF"
FONT_KAITI = r"C:\Windows\Fonts\simkai.ttf"
FONT_SONG = r"C:\Windows\Fonts\simsun.ttc"
FONT_HEI = r"C:\Windows\Fonts\msyh.ttc"
FONT_HEI_BOLD = r"C:\Windows\Fonts\msyhbd.ttc"


def make_paper() -> Image.Image:
    random.seed(20260611)
    base = Image.new("RGB", (WIDTH, HEIGHT), (247, 240, 226))
    px = base.load()
    for y in range(HEIGHT):
        for x in range(WIDTH):
            grain = random.randint(-4, 5)
            vertical = int(14 * y / HEIGHT)
            edge = int(10 * abs(x - WIDTH / 2) / (WIDTH / 2))
            px[x, y] = (
                max(0, min(255, 250 + grain - vertical - edge // 2)),
                max(0, min(255, 244 + grain - vertical)),
                max(0, min(255, 231 + grain - vertical - edge)),
            )

    fibers = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    draw = ImageDraw.Draw(fibers)
    for _ in range(460):
        x = random.randint(-80, WIDTH)
        y = random.randint(0, HEIGHT)
        length = random.randint(60, 260)
        drift = random.randint(-12, 12)
        color = random.choice(
            [
                (177, 146, 94, 16),
                (255, 255, 247, 30),
                (198, 171, 120, 14),
            ]
        )
        draw.line((x, y, x + length, y + drift), fill=color, width=random.choice([1, 1, 2]))

    return Image.alpha_composite(base.convert("RGBA"), fibers.filter(ImageFilter.GaussianBlur(0.25)))


def rounded_rect(draw: ImageDraw.ImageDraw, box, radius, fill, outline=None, width=1):
    draw.rounded_rectangle(box, radius=radius, fill=fill, outline=outline, width=width)


def draw_wrapped(draw: ImageDraw.ImageDraw, text: str, xy, max_chars: int, font_obj, fill, line_gap=14):
    x, y = xy
    for line in textwrap.wrap(text, width=max_chars):
        draw.text((x, y), line, font=font_obj, fill=fill)
        y += font_obj.size + line_gap
    return y


def text_center(draw: ImageDraw.ImageDraw, text: str, y: int, font_obj, fill):
    box = draw.textbbox((0, 0), text, font=font_obj)
    x = (WIDTH - (box[2] - box[0])) // 2
    draw.text((x, y), text, font=font_obj, fill=fill)


def make_poster() -> Image.Image:
    image = make_paper()
    draw = ImageDraw.Draw(image)

    ink = (38, 33, 27, 255)
    muted = (105, 82, 58, 255)
    cinnabar = (174, 48, 38, 255)
    dark_green = (47, 82, 61, 255)

    title_font = font(FONT_XINGKAI, 104)
    subtitle_font = font(FONT_KAITI, 40)
    body_font = font(FONT_SONG, 34)
    small_font = font(FONT_HEI, 28)
    feature_font = font(FONT_HEI_BOLD, 30)

    # Quiet ink wash bands.
    wash = Image.new("RGBA", (WIDTH, HEIGHT), (0, 0, 0, 0))
    wash_draw = ImageDraw.Draw(wash)
    wash_draw.arc((-220, 130, 1280, 810), start=188, end=338, fill=(60, 72, 58, 24), width=20)
    wash_draw.arc((-120, 820, 1180, 1470), start=196, end=342, fill=(130, 86, 52, 18), width=18)
    wash_draw.line((120, 1220, 960, 1175), fill=(62, 84, 65, 28), width=8)
    image = Image.alpha_composite(image, wash.filter(ImageFilter.GaussianBlur(0.8)))
    draw = ImageDraw.Draw(image)

    # Logo card.
    logo_size = 300
    logo = Image.open(LOGO_PATH).convert("RGBA").resize((logo_size, logo_size), Image.Resampling.LANCZOS)
    shadow = Image.new("RGBA", (logo_size + 60, logo_size + 60), (0, 0, 0, 0))
    shadow_draw = ImageDraw.Draw(shadow)
    shadow_draw.rounded_rectangle((30, 30, logo_size + 30, logo_size + 30), radius=62, fill=(84, 62, 38, 42))
    shadow = shadow.filter(ImageFilter.GaussianBlur(18))
    image.alpha_composite(shadow, ((WIDTH - shadow.width) // 2, 80))
    image.alpha_composite(logo, ((WIDTH - logo_size) // 2, 96))

    text_center(draw, "墨舞丹青", 438, title_font, ink)
    text_center(draw, "让每一幅国画，都有自己的案卷", 548, subtitle_font, muted)

    intro = "整理作品、归档素材、记录标签、生成分享海报。把创作背后的灵感、过程与细节，安静地留在一处。"
    y = draw_wrapped(draw, intro, (138, 635), 23, body_font, ink, line_gap=16)

    # Feature panel.
    panel_top = y + 44
    panel_left = 86
    panel_right = WIDTH - 86
    panel_bottom = panel_top + 372
    rounded_rect(draw, (panel_left, panel_top, panel_right, panel_bottom), 34, (255, 251, 241, 154), (178, 139, 84, 72), 2)

    features = [
        ("作品归档", "图片、附件、说明与创作记录统一保存"),
        ("素材管理", "参考图、题材、纹样、资料随手收藏"),
        ("标签检索", "按题材、风格、阶段快速找到内容"),
        ("海报分享", "生成雅致画框海报，适合微信分享"),
    ]
    fy = panel_top + 48
    for title, desc in features:
        draw.ellipse((132, fy + 11, 148, fy + 27), fill=cinnabar)
        draw.text((170, fy), title, font=feature_font, fill=dark_green)
        draw.text((318, fy + 2), desc, font=small_font, fill=muted)
        fy += 78

    # Bottom callout.
    callout_y = panel_bottom + 72
    draw.text((118, callout_y), "适合国画创作者、学习者、收藏整理者试用", font=font(FONT_KAITI, 38), fill=ink)
    draw.text((118, callout_y + 68), "邀请码注册 · 小范围开放体验", font=small_font, fill=cinnabar)

    # Seal-like signature.
    seal_x, seal_y = WIDTH - 214, HEIGHT - 214
    rounded_rect(draw, (seal_x, seal_y, seal_x + 86, seal_y + 86), 16, cinnabar)
    draw.rounded_rectangle((seal_x + 12, seal_y + 12, seal_x + 74, seal_y + 74), radius=9, outline=(255, 241, 218, 230), width=5)
    draw.text((seal_x + 27, seal_y + 20), "丹", font=font(FONT_KAITI, 28), fill=(255, 241, 218, 255))
    draw.text((seal_x + 27, seal_y + 50), "青", font=font(FONT_KAITI, 28), fill=(255, 241, 218, 255))

    # Subtle border.
    draw.rounded_rectangle((36, 36, WIDTH - 36, HEIGHT - 36), radius=42, outline=(164, 132, 82, 80), width=2)
    return image


if __name__ == "__main__":
    poster = make_poster()
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    poster.convert("RGB").save(OUTPUT_PATH, quality=95)
    print(OUTPUT_PATH)
