import sys
from PIL import Image, ImageDraw, ImageFont

# Usage: python3 scripts/make-brand.py assets [preview.png]
OUT = sys.argv[1]
PREVIEW = sys.argv[2] if len(sys.argv) > 2 else None
FONT = '/usr/share/fonts/julietaula-montserrat-fonts/Montserrat-Black.otf'
FONT_B = '/usr/share/fonts/julietaula-montserrat-fonts/Montserrat-Bold.otf'
GREEN = (11, 122, 92)
GREEN_LIGHT = (19, 165, 125)
GREEN_DARK = (6, 90, 67)
WHITE = (255, 255, 255, 255)

def dumbbell(draw, cx, cy, w, color):
    """Horizontal dumbbell centered at (cx, cy) with total width w."""
    s = w / 520
    def r(x0, y0, x1, y1, rad):
        draw.rounded_rectangle([cx + x0 * s, cy + y0 * s, cx + x1 * s, cy + y1 * s], radius=rad * s, fill=color)
    r(-170, -18, 170, 18, 12)          # bar
    for side in (-1, 1):
        def m(a, b):
            return (a, b) if side > 0 else (-b, -a)
        x0, x1 = m(150, 205); r(x0, -85, x1, 85, 20)   # big plate
        x0, x1 = m(210, 250); r(x0, -60, x1, 60, 16)   # small plate
        x0, x1 = m(250, 260); r(x0, -14, x1, 14, 5)    # end cap

def text_center(draw, cx, y, text, font, fill, spacing=0):
    widths = [draw.textlength(ch, font=font) for ch in text]
    total = sum(widths) + spacing * (len(text) - 1)
    x = cx - total / 2
    for ch, wch in zip(text, widths):
        draw.text((x, y), ch, font=font, fill=fill)
        x += wch + spacing

def logo(size, scale, with_gym=False, color=WHITE):
    img = Image.new('RGBA', (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    c = size / 2
    font = ImageFont.truetype(FONT, int(190 * scale))
    gym = ImageFont.truetype(FONT_B, int(54 * scale))
    block_h = (170 + 40 + 150 + (70 if with_gym else 0)) * scale
    top = c - block_h / 2
    dumbbell(d, c, top + 85 * scale, 470 * scale, color)
    asc = font.getbbox('EGO')[1]
    text_center(d, c, top + 210 * scale - asc, 'EGO', font, color, spacing=8 * scale)
    if with_gym:
        gasc = gym.getbbox('GYM')[1]
        faded = color[:3] + (200,)
        text_center(d, c, top + 395 * scale - gasc, 'GYM', gym, faded, spacing=26 * scale)
    return img

def gradient(size):
    img = Image.new('RGB', (size, size), GREEN)
    px = img.load()
    for y in range(size):
        for x in range(size):
            t = (x + y) / (2 * size)
            px[x, y] = tuple(int(GREEN_LIGHT[i] * (1 - t) + GREEN_DARK[i] * t) for i in range(3))
    return img

# Adaptive icon: background + foreground kept inside the 66% safe zone.
bg = gradient(1024)
bg.save(f'{OUT}/android-icon-background.png')
fg = logo(1024, 1.0)
fg.save(f'{OUT}/android-icon-foreground.png')
mono = logo(432, 432 / 1024)
mono.save(f'{OUT}/android-icon-monochrome.png')
icon = bg.copy().convert('RGBA')
icon.alpha_composite(logo(1024, 1.25))
icon.convert('RGB').save(f'{OUT}/icon.png')
icon.convert('RGB').resize((48, 48), Image.LANCZOS).save(f'{OUT}/favicon.png')
splash = logo(1024, 1.55, with_gym=True)
splash.save(f'{OUT}/splash-icon.png')

# Preview sheet to approve changes before replacing the assets.
if not PREVIEW:
    sys.exit(0)
W, H = 1700, 1050
sheet = Image.new('RGB', (W, H), (245, 246, 248))
d = ImageDraw.Draw(sheet)
label = ImageFont.truetype(FONT_B, 30)
d.text((70, 50), 'Ícono de la app', font=label, fill=(16, 24, 40))
big = icon.resize((420, 420), Image.LANCZOS)
mask = Image.new('L', (420, 420), 0)
ImageDraw.Draw(mask).rounded_rectangle([0, 0, 420, 420], radius=110, fill=255)
sheet.paste(big, (70, 120), mask)
d.text((70, 560), 'Adaptable (círculo, como en Android)', font=ImageFont.truetype(FONT_B, 22), fill=(102, 112, 133))
for i, s in enumerate((200, 128, 72)):
    adaptive = bg.copy().convert('RGBA'); adaptive.alpha_composite(fg)
    a = adaptive.resize((s, s), Image.LANCZOS)
    m = Image.new('L', (s, s), 0); ImageDraw.Draw(m).ellipse([0, 0, s, s], fill=255)
    x = 70 + sum((200, 128, 72)[:i]) + 40 * i
    sheet.paste(a, (x, 610 + (200 - s) // 2), m)
d.text((70, 860), 'Monocromo (íconos temáticos)', font=ImageFont.truetype(FONT_B, 22), fill=(102, 112, 133))
m2 = Image.new('RGBA', (120, 120), (52, 64, 84, 255)); m2.alpha_composite(mono.resize((120, 120), Image.LANCZOS))
mk = Image.new('L', (120, 120), 0); ImageDraw.Draw(mk).ellipse([0, 0, 120, 120], fill=255)
sheet.paste(m2, (70, 900), mk)

d.text((1100, 50), 'Splash', font=label, fill=(16, 24, 40))
phone = Image.new('RGB', (450, 900), GREEN)
p = splash.resize((360, 360), Image.LANCZOS)  # ~180dp on a 360dp-wide phone
phone_rgba = phone.convert('RGBA'); phone_rgba.alpha_composite(p, (45, 270))
pm = Image.new('L', (450, 900), 0); ImageDraw.Draw(pm).rounded_rectangle([0, 0, 450, 900], radius=48, fill=255)
sheet.paste(phone_rgba, (1100, 110), pm)
d.rounded_rectangle([1096, 106, 1554, 1014], radius=52, outline=(16, 24, 40), width=6)
sheet.save(PREVIEW)
print('ok')
