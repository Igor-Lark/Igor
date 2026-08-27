#!/usr/bin/env python3
"""GIF 240×400: солнце вниз-вправо, небо темнеет, текст ПРОГУЛКИ / под парусом."""

from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parent
SRC = ROOT / "source.png"
OUT = ROOT / "gp-sun-240x400.gif"
PREVIEW = ROOT / "preview-frame.png"
PREVIEW_END = ROOT / "preview-end.png"
FRAMES = ROOT / "frames"

W, H = 240, 400
MAX_BYTES = 120 * 1024
FONT_BOLD = "/usr/share/fonts/truetype/macos/Inter-Bold.ttf"
FONT_SEMI = "/usr/share/fonts/truetype/macos/Inter-SemiBold.ttf"
SUN = (255, 159, 28)
N = 12


def is_sun(r: np.ndarray, g: np.ndarray, b: np.ndarray) -> np.ndarray:
    r16 = r.astype(np.int16)
    g16 = g.astype(np.int16)
    b16 = b.astype(np.int16)
    solid = (r16 > 195) & (g16 > 120) & (g16 < 245) & (b16 < 100) & ((r16 - b16) > 110)
    gold = (r16 > 175) & (g16 > 100) & (b16 < 140) & ((r16 - b16) > 70) & ((r16 - g16) < 90)
    return solid | gold


def ease(t: float) -> float:
    return t * t * (3 - 2 * t)


def sky_fill_row(arr: np.ndarray, y: int, sky_cols: np.ndarray, cx: int, R: int, x: int) -> np.ndarray:
    if sky_cols.size == 0:
        return np.array([90, 155, 208], dtype=np.float64)
    left = sky_cols[sky_cols < cx]
    right = sky_cols[sky_cols > cx]
    cL = arr[y, left].mean(0) if left.size else None
    cR = arr[y, right].mean(0) if right.size else None
    if cL is not None and cR is not None:
        t = min(1.0, max(0.0, (x - (cx - R)) / max(1.0, 2 * R)))
        return (1 - t) * cL + t * cR
    if cL is not None:
        return cL
    if cR is not None:
        return cR
    return arr[y, sky_cols].mean(0)


def prepare(src: Image.Image):
    img = src.convert("RGB").resize((W, H), Image.Resampling.LANCZOS)
    arr = np.array(img)
    r, g, b = arr[:, :, 0], arr[:, :, 1], arr[:, :, 2]
    Y, X = np.ogrid[:H, :W]

    sunm = is_sun(r, g, b) & (Y < int(H * 0.52))
    ys, xs = np.where(sunm)
    cx, cy = int(np.median(xs)), int(np.median(ys))
    R = int(np.percentile(np.sqrt((xs - cx) ** 2 + (ys - cy) ** 2), 96)) + 2
    print(f"sun cx={cx} cy={cy} R={R}")

    # Полный геометрический диск → небо (паруса вернёт слой boat)
    clean = arr.copy()
    circ = (X - cx) ** 2 + (Y - cy) ** 2 <= (R + 3) ** 2
    sky = (Y < int(H * 0.46)) & ~circ & (b.astype(int) > r.astype(int) + 25) & (b > 130)

    for y in range(max(0, cy - R - 4), min(H, cy + R + 5)):
        cols = np.where(circ[y])[0]
        if cols.size == 0:
            continue
        sc = np.where(sky[y])[0]
        for x in cols:
            clean[y, x] = sky_fill_row(arr, y, sc, cx, R, x)

    # Добить оставшиеся оранжевые пиксели в верхней половине
    still = is_sun(clean[:, :, 0], clean[:, :, 1], clean[:, :, 2]) & (Y < int(H * 0.52))
    for y, x in zip(*np.where(still)):
        sc = np.where(sky[y])[0] if y < H else np.array([])
        if sc.size:
            clean[y, x] = arr[y, sc].mean(0)
        else:
            clean[y, x] = (90, 155, 208)

    # Отражение солнца в воде
    refl = is_sun(r, g, b) & (Y >= int(H * 0.48))
    water = (b.astype(int) > r.astype(int) + 15) & (b > 70) & (Y >= int(H * 0.45)) & ~refl
    for y, x in zip(*np.where(refl)):
        y0, y1 = max(0, y - 4), min(H, y + 5)
        x0, x1 = max(0, x - 4), min(W, x + 5)
        pm = water[y0:y1, x0:x1]
        clean[y, x] = (
            clean[y0:y1, x0:x1][pm].mean(0) if pm.any() else np.array([35, 85, 145])
        )

    clean_im = Image.fromarray(clean.astype(np.uint8))

    # Передний план: яхта, люди, текст, отражение корпуса.
    # Небо и открытая вода — прозрачные, иначе движущееся солнце перекрывается.
    r16, g16, b16 = r.astype(np.int16), g.astype(np.int16), b.astype(np.int16)
    white = (r16 > 165) & (g16 > 155) & (b16 > 140) & (np.abs(r16 - g16) < 45)
    wood = (r16 > 90) & (r16 > g16) & (g16 > b16) & (b16 < 130) & (r16 < 210)
    dark = (r16 < 85) & (g16 < 85) & (b16 < 85)
    skin = (r16 > 140) & (g16 > 90) & (b16 > 70) & (r16 > b16) & ((r16 - g16) < 70)
    cloth = ((g16 > r16 + 15) & (g16 > 80) & (b16 > 60)) | ((b16 > 100) & (r16 < 120) & (g16 < 160))
    fg = white | wood | dark | skin | cloth
    fg &= ~is_sun(r, g, b)
    alpha_im = Image.fromarray((fg.astype(np.uint8) * 255)).filter(ImageFilter.MaxFilter(3))
    alpha = np.array(alpha_im)
    boat = Image.fromarray(np.dstack([arr, alpha]))
    return clean_im, boat, cx, cy, R


def render_frame(clean: Image.Image, boat: Image.Image, cx: int, cy: int, R: int, t: float) -> Image.Image:
    e = ease(t)
    # вниз-вправо, к концу круг остаётся в небе справа от мачт
    sx = cx + (W - R - 18 - cx) * e
    sy = cy + (int(H * 0.34) - cy) * e

    base = clean.convert("RGBA")
    sun_l = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(sun_l)
    rr = float(R)
    d.ellipse((sx - rr, sy - rr, sx + rr, sy + rr), fill=(*SUN, 255))

    # слабое отражение
    ry = sy + H * 0.17
    d.ellipse(
        (sx - rr * 0.88, ry - rr * 0.88, sx + rr * 0.88, ry + rr * 0.88),
        fill=(*SUN, int(70 * (1 - 0.3 * e))),
    )

    img = Image.alpha_composite(base, sun_l)
    img = Image.alpha_composite(img, boat)

    # небо темнеет
    dark = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    dd = ImageDraw.Draw(dark)
    max_a = int(110 * e)
    band = int(H * 0.40)
    for yi in range(band):
        a = int(max_a * (1 - yi / band) ** 1.2)
        if a:
            dd.line([(0, yi), (W, yi)], fill=(16, 6, 34, a))
    img = Image.alpha_composite(img, dark)

    # текст из прозрачности
    tt = ease(min(1.0, max(0.0, (t - 0.18) / 0.55)))
    if tt > 0:
        tl = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        td = ImageDraw.Draw(tl)
        f1 = ImageFont.truetype(FONT_BOLD, 22)
        f2 = ImageFont.truetype(FONT_SEMI, 16)
        a = int(255 * tt)
        for ox, oy, fill in ((1, 1, (0, 0, 0, int(a * 0.45))), (0, 0, (255, 255, 255, a))):
            td.text((W // 2 + ox, 12 + oy), "ПРОГУЛКИ", font=f1, fill=fill, anchor="mt")
            td.text((W // 2 + ox, 38 + oy), "под парусом", font=f2, fill=fill, anchor="mt")
        img = Image.alpha_composite(img, tl)

    return ImageEnhance.Contrast(img.convert("RGB")).enhance(1.04)


def encode_gif(frame_paths: list[Path], colors: int = 48) -> int:
    palette = ROOT / "palette.png"
    pattern = str(FRAMES / "f%02d.png")
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            "10",
            "-i",
            pattern,
            "-vf",
            f"palettegen=max_colors={colors}:stats_mode=diff",
            str(palette),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    subprocess.check_call(
        [
            "ffmpeg",
            "-y",
            "-framerate",
            "10",
            "-i",
            pattern,
            "-i",
            str(palette),
            "-lavfi",
            "paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle",
            str(OUT),
        ],
        stdout=subprocess.DEVNULL,
        stderr=subprocess.DEVNULL,
    )
    return OUT.stat().st_size


def main() -> None:
    if not SRC.exists():
        raise SystemExit(f"Нет исходника: {SRC}")

    if FRAMES.exists():
        shutil.rmtree(FRAMES)
    FRAMES.mkdir(parents=True)

    clean, boat, cx, cy, R = prepare(Image.open(SRC))
    clean.save(ROOT / "clean.png")

    frames: list[Image.Image] = []
    for i in range(N):
        fr = render_frame(clean, boat, cx, cy, R, i / (N - 1))
        frames.append(fr)
        fr.save(FRAMES / f"f{i:02d}.png")

    # удержание финала
    for j in range(3):
        shutil.copy(FRAMES / f"f{N - 1:02d}.png", FRAMES / f"f{N + j:02d}.png")

    frames[0].save(PREVIEW)
    frames[-1].save(PREVIEW_END)
    frames[N // 2].save(ROOT / "preview-mid.png")

    size = encode_gif(list(FRAMES.glob("f*.png")), colors=48)
    print(f"colors=48  {size} bytes")
    if size > MAX_BYTES:
        size = encode_gif(list(FRAMES.glob("f*.png")), colors=40)
        print(f"colors=40  {size} bytes")
    if size > MAX_BYTES:
        raise SystemExit("GIF больше 120 КБ")
    print(f"OUT {OUT.name}  {size} bytes  limit={MAX_BYTES}")


if __name__ == "__main__":
    main()
