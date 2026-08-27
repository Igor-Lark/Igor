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
# исходные удержания 1400/1200 + 30%
HOLD_MS = [1820, 1560, 1560, 1560]
FADE_STEPS = 7
FADE_FRAME_MS = 90  # 7 кадров × 90 мс ≈ 630 мс кроссфейд
LINE_Y = 332
# Новое фото: яхта по центру, длинное отражение снизу — корпус над ценой
ZOOM = 1.48
CROP_TOP_FRAC = 0.52


def font(path: str, size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(path, size)


def cover_crop(im: Image.Image, w: int, h: int) -> Image.Image:
    src_w, src_h = im.size
    scale = max(w / src_w, h / src_h) * ZOOM
    nw, nh = int(src_w * scale), int(src_h * scale)
    im = im.resize((nw, nh), Image.Resampling.LANCZOS)
    left = (nw - w) // 2
    top = int((nh - h) * CROP_TOP_FRAC)
    return im.crop((left, top, left + w, top + h))


def draw_centered(
    draw: ImageDraw.ImageDraw,
    text: str,
    y: int,
    fnt: ImageFont.FreeTypeFont,
    fill=WHITE,
) -> None:
    draw.text((W // 2, y), text, font=fnt, fill=fill, anchor="mt", align="center")


def base_photo() -> Image.Image:
    photo = Image.open(SRC).convert("RGB")
    photo = cover_crop(photo, W, H)
    photo = ImageEnhance.Color(photo).enhance(1.12)
    photo = ImageEnhance.Contrast(photo).enhance(1.08)
    photo = photo.filter(ImageFilter.GaussianBlur(radius=0.45))
    return photo


def paint_static(img: Image.Image) -> Image.Image:
    """Фото, градиенты, заголовок, цена, кнопка — без ротации."""
    overlay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(overlay)

    for i in range(150):
        a = int(200 * (1 - i / 150) ** 0.85)
        d.line([(0, i), (W, i)], fill=(0, 16, 36, a))
    for i in range(145):
        y = H - 145 + i
        a = int(235 * (i / 145) ** 1.05)
        d.line([(0, y), (W, y)], fill=(0, 10, 24, a))

    img = Image.alpha_composite(img.convert("RGBA"), overlay)
    draw = ImageDraw.Draw(img)

    loc = font(FONT_SEMI, 12)
    title = font(FONT_BOLD, 20)
    price = font(FONT_BOLD, 28)
    cta_f = font(FONT_BOLD, 13)

    draw_centered(draw, "СИРИУС  ·  причал 2", 12, loc)
    draw_centered(draw, "ПРОГУЛКИ", 34, title)
    draw_centered(draw, "ПОД ПАРУСОМ", 58, title)
    draw_centered(draw, "1 800 ₽/чел", 298, price)

    bw, bh = 154, 34
    bx, by = (W - bw) // 2, 358
    draw.rounded_rectangle((bx, by, bx + bw, by + bh), radius=8, fill=ORANGE)
    draw.text((W // 2, by + bh // 2), "РАСПИСАНИЕ", font=cta_f, fill=DARK, anchor="mm")
    return img


def with_lines(base: Image.Image, parts: list[tuple[str, float]]) -> Image.Image:
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    draw = ImageDraw.Draw(layer)
    line_f = font(FONT_BOLD, 16)
    for text, alpha in parts:
        if alpha <= 0:
            continue
        fill = (255, 255, 255, max(0, min(255, int(round(255 * alpha)))))
        draw.text((W // 2, LINE_Y), text, font=line_f, fill=fill, anchor="mt")
    return Image.alpha_composite(base, layer).convert("RGB")


def build_timeline(base: Image.Image) -> tuple[list[Image.Image], list[int]]:
    frames: list[Image.Image] = []
    durations: list[int] = []
    n = len(LINES)
    for i, line in enumerate(LINES):
        frames.append(with_lines(base, [(line, 1.0)]))
        durations.append(HOLD_MS[i])
        nxt = LINES[(i + 1) % n]
        for step in range(1, FADE_STEPS + 1):
            t = step / (FADE_STEPS + 1)
            frames.append(with_lines(base, [(line, 1.0 - t), (nxt, t)]))
            durations.append(FADE_FRAME_MS)
    return frames, durations


def quantize_global(frames: list[Image.Image], colors: int) -> list[Image.Image]:
    # палитра с холдов — те же цвета, что и на фейдах
    sample = frames[:: FADE_STEPS + 1][: len(LINES)]
    atlas = Image.new("RGB", (W, H * len(sample)))
    for i, fr in enumerate(sample):
        atlas.paste(fr, (0, i * H))
    pal = atlas.quantize(colors=colors, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.NONE)
    return [fr.quantize(palette=pal, dither=Image.Dither.NONE) for fr in frames]


def save_gif(frames_q: list[Image.Image], durations: list[int], path: Path) -> int:
    frames_q[0].save(
        path,
        save_all=True,
        append_images=frames_q[1:],
        duration=durations,
        loop=0,
        optimize=True,
        disposal=1,
    )
    return path.stat().st_size


def main() -> None:
    base = paint_static(base_photo())
    frames, durations = build_timeline(base)
    frames[0].save(PREVIEW)
    print(f"frames={len(frames)}  cycle_ms={sum(durations)}")

    chosen = None
    for colors in (64, 48, 40, 32, 28, 24):
        size = save_gif(quantize_global(frames, colors), durations, OUT)
        print(f"colors={colors:2d}  {size:6d} bytes")
        if size <= MAX_BYTES:
            chosen = size
            break
    if chosen is None:
        raise SystemExit("GIF больше 120 КБ даже на 24 цветах")
    print(f"OUT {OUT.name}  {chosen} bytes  limit={MAX_BYTES}")


if __name__ == "__main__":
    main()
