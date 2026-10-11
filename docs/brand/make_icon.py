# Genera l'icona dell'app: "K" in Pacifico, stile retrò come "Ma Lei" (lettera + estrusione crema + ombra), su rosa.
# Uso: python make_icon.py  (serve Pillow). Produce icon-1024.png e AppIcon.icns in questa cartella.
import pathlib, shutil, subprocess, tempfile
from PIL import Image, ImageDraw, ImageFilter, ImageFont

HERE = pathlib.Path(__file__).parent
PINK_TOP, PINK_BOTTOM = (255, 143, 196), (255, 79, 154)
VIOLET, CREAM, PLUM = (107, 43, 217), (255, 240, 217), (43, 17, 69)
SIZE, MARGIN, RADIUS = 1024, 100, 185  # griglia icone macOS: 824x824 con angoli arrotondati

def icon():
    img = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    grad = Image.new("RGBA", (SIZE, SIZE))
    for y in range(SIZE):
        t = y / SIZE
        grad.paste(tuple(int(a + (b - a) * t) for a, b in zip(PINK_TOP, PINK_BOTTOM)), (0, y, SIZE, y + 1))
    mask = Image.new("L", (SIZE, SIZE), 0)
    ImageDraw.Draw(mask).rounded_rectangle((MARGIN, MARGIN, SIZE - MARGIN, SIZE - MARGIN), RADIUS, fill=255)
    img.paste(grad, mask=mask)

    font = ImageFont.truetype(str(HERE / "Pacifico-Regular.ttf"), 560)
    l, t, r, b = font.getbbox("K")
    x, y = (SIZE - (r - l)) / 2 - l - 14, (SIZE - (b - t)) / 2 - t - 14

    shadow = Image.new("RGBA", (SIZE, SIZE), (0, 0, 0, 0))
    ImageDraw.Draw(shadow).text((x + 34, y + 34), "K", font=font, fill=PLUM + (110,))
    img.alpha_composite(shadow.filter(ImageFilter.GaussianBlur(6)))
    d = ImageDraw.Draw(img)
    for i in range(22, 0, -1):  # estrusione crema
        d.text((x + i, y + i), "K", font=font, fill=CREAM)
    d.text((x, y), "K", font=font, fill=VIOLET)
    return img

def main():
    big = icon()
    big.save(HERE / "icon-1024.png")
    with tempfile.TemporaryDirectory() as tmp:
        iconset = pathlib.Path(tmp) / "AppIcon.iconset"
        iconset.mkdir()
        for s in (16, 32, 128, 256, 512):
            big.resize((s, s), Image.LANCZOS).save(iconset / f"icon_{s}x{s}.png")
            big.resize((s * 2, s * 2), Image.LANCZOS).save(iconset / f"icon_{s}x{s}@2x.png")
        subprocess.run(["iconutil", "-c", "icns", str(iconset), "-o", str(HERE / "AppIcon.icns")], check=True)

if __name__ == "__main__":
    main()
