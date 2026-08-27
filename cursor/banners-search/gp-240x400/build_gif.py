#!/usr/bin/env python3
"""Собрать GIF 240×400 ≤120 КБ для контекстного баннера в Поиске Директа."""

from __future__ import annotations

from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

W, H = 240, 400
MAX_BYTES = 120 * 1024
ROOT = Path(__file__).resolve().parent
SRC = ROOT / "source-yacht.jpg"
OUT = ROOT / "gp-search-240x400.gif"
PREVIEW = ROOT / "preview-frame.png"

FONT_BOLD = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
FONT_SEMI = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"
ORANGE = (255, 152, 0)
WHITE = (255, 255, 255)
DARK = (17, 17, 17)

LINES = ["до 11 чел.", "1,5 часа", "купание в море", "заявка на сайте"]
HOLD_MS = [1400, 1200, 1200, 1200]


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def cover_crop(im: Image.Image, w: int, h: int) -> Image.Image:
    src_w, src_h = im.size
    scale = max(w / src_w, h / src_h)
    nw, nh = int(src_w * scale), int(src_h * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = int((nh - h) * 0.42)
    return im.crop((left, top, left + w, top + h))


def draw_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    fnt: ImageFont.FreeTypeFont,
    fill=WHITE,
    stroke=2,
    stroke_fill=(0, 0, 0),
) -> None:
    draw.text(
        (W // 2, y),
        text,
        font=fnt,
        fill=fill,
        anchor="mt",
        stroke_width=stroke,
        stroke_fill=stroke_fill,
        align="center",
    )


def base_photo() -> Image.Image:
    photo = Image.open(SRC).convert("RGB")
    photo = cover_crop(photo, W, H)
    photo = ImageEnhance.Color(photo).enhance(1.12)
    photo = ImageEnhance.Contrast(photo).enhance(1.08)
    photo = photo.filter(ImageFilter.GaussianBlur(radius=0.45))
    return photo


def paint_chrome(img: Image.Image, line: str) -> Image.Image:
    img = img.copy()
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    for i in range(128):
        a = int(150 * (1 - i / 128))
        d.line([(0, i), (W, i)], fill=(0, 20, 40, a))
    for i in range(170):
        y = H - 170 + i
        a = int(210 * (i / 170) ** 1.15)
        d.line([(0, y), (W, y)], fill=(0, 12, 28, a))

    img = Image.alpha_composite(img.convert("RGBA"), overlay).convert("RGB")
    draw = ImageDraw.Draw(img)

    loc = font(FONT_SEMI, 12)
    title = font(FONT_BOLD, 20)
    price = font(FONT_BOLD, 28)
    line_f = font(FONT_BOLD, 16)
    cta_f = font(FONT_BOLD, 13)

    draw_centered(draw, "СИРИУС  ·  причал 2", 12, loc, stroke=1)
    draw_centered(draw, "ПРОГУЛКИ", 34, title, stroke=2)
    draw_centered(draw, "ПОД ПАРУСОМ", 58, title, stroke=2)
    draw_centered(draw, "1 800 ₽/чел", 286, price, fill=WHITE, stroke=3)
    draw_centered(draw, line, 324, line_f, stroke=2)

    bw, bh = 154, 34
    bx, by = (W - bw) // 2, 356
    draw.rounded_rectangle((bx, by, bx + bw, by + bh), radius=8, fill=ORANGE)
    draw.text((W // 2, by + bh // 2), "РАСПИСАНИЕ", font=cta_f, fill=DARK, anchor="mm")
    return img


def quantize_global(frames: list[Image.Image], colors: int) -> list[Image.Image]:
    atlas = Image.new("RGB", (W, H * len(frames)))
    for i, fr in enumerate(frames):
        atlas.paste(fr, (0, i * H))
    pal = atlas.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return [fr.quantize(palette=pal, dither=Image.Dither.NONE) for fr in frames]


def save_gif(frames_q: list[Image.Image], path: Path) -> int:
    frames_q[0].save(
        path,
        save_all=True,
        append_images=frames_q[1:],
        duration=HOLD_MS,
        loop=0,
        optimize=True,
        disposal=2,
    )
    return path.stat().st_size


def main() -> None:
    photo = base_photo()
    frames = [paint_chrome(photo, line) for line in LINES]
    frames[0].save(PREVIEW)

    chosen = None
    for colors in (64, 48, 40, 32, 28, 24):
        size = save_gif(quantize_global(frames, colors), OUT)
        print(f"colors={colors:2d}  {size:6d} bytes")
        if size <= MAX_BYTES:
            chosen = size
            break
    if chosen is None:
        raise SystemExit("GIF больше 120 КБ даже на 24 цветах")
    print(f"OUT {OUT.name}  {chosen} bytes  limit={MAX_BYTES}")


if __name__ == "__main__":
    main()
