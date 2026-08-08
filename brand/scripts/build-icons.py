#!/usr/bin/env python3
"""
Build the Sharing app icon family.

The icon is a front-view autorickshaw in kaali-peeli livery, with the first
letter of the local word for "sharing" set into the windshield. Mumbai gets
Devanagari शे; the same motif carries a different letter in each region, which
is the point — the icon should look like it belongs to the street it's used on.

The letters are real vector outlines, extracted from Noto Sans (see
`glyphs.json`), shaped with HarfBuzz so the matra sits where a typesetter would
put it. They are NOT live text, so the icon renders identically everywhere with
no font to install and nothing to go wrong at build time.

Usage:  python3 brand/scripts/build-icons.py
Output: brand/*.svg
"""

from __future__ import annotations

import json
from pathlib import Path

HERE = Path(__file__).resolve().parent
BRAND = HERE.parent

# ── Kaali-peeli palette ─────────────────────────────────────────────────────
PEELI = "#FFC531"   # taxi yellow — the recognisable one
PEELI_DEEP = "#F0A81C"  # shadow yellow, for the dome highlight
KAALI = "#141210"   # soft black; pure #000 looks like a hole on OLED
KAALI_SOFT = "#26221E"

SIZE = 1024

# Where the letter sits inside the windshield.
GLYPH_BOX = {"x": 282, "y": 292, "w": 460, "h": 288}

REGIONS = {
    "hi": "Hindi — शेअरिंग (default, Mumbai / North India)",
    "mr": "Marathi — शेअरिंग (Maharashtra)",
    "te": "Telugu — షేరింగ్ (Hyderabad)",
    "ta": "Tamil — ஷேரிங் (Chennai)",
    "kn": "Kannada — ಶೇರಿಂಗ್ (Bengaluru)",
}


def glyph_transform(glyph: dict) -> str:
    """Uniformly scale a glyph's outline to fit the windshield, centred."""
    b = glyph["bounds"]
    gw = b["xMax"] - b["xMin"]
    gh = b["yMax"] - b["yMin"]
    scale = min(GLYPH_BOX["w"] / gw, GLYPH_BOX["h"] / gh)

    # Centre the scaled bbox inside the box.
    tx = GLYPH_BOX["x"] + (GLYPH_BOX["w"] - gw * scale) / 2 - b["xMin"] * scale
    ty = GLYPH_BOX["y"] + (GLYPH_BOX["h"] - gh * scale) / 2 - b["yMin"] * scale
    return f"translate({tx:.2f} {ty:.2f}) scale({scale:.5f})"


# ── The rickshaw motif ──────────────────────────────────────────────────────
# Front elevation: domed canopy, big windshield, apron with a single headlight,
# two mirror stalks. Everything below reads at 48dp, which is the real test.

# The dome is what makes a rickshaw a rickshaw. Keep the arch tall and the body
# tapered — a straight-sided box reads as a bus, which is the wrong vehicle.
CANOPY = (
    "M 186 800 L 178 456 "
    "C 178 244 320 128 512 128 "
    "C 704 128 846 244 846 456 "
    "L 838 800 Z"
)

WINDSCREEN = (
    "M 300 246 H 724 "
    "C 762 246 780 266 784 300 "
    "L 806 586 C 809 620 790 638 754 638 "
    "H 270 C 234 638 215 620 218 586 "
    "L 240 300 C 244 266 262 246 300 246 Z"
)

# Mirror stalks + housings.
MIRRORS = (
    '<g fill="{kaali}">'
    '<rect x="132" y="356" width="62" height="24" rx="12"/>'
    '<rect x="830" y="356" width="62" height="24" rx="12"/>'
    '<ellipse cx="116" cy="352" rx="30" ry="39"/>'
    '<ellipse cx="908" cy="352" rx="30" ry="39"/>'
    "</g>"
)

# Apron: headlight and grille slots, cut in yellow out of the black body.
APRON = (
    '<g fill="{peeli}">'
    '<circle cx="512" cy="702" r="56"/>'
    '<rect x="240" y="684" width="146" height="30" rx="15"/>'
    '<rect x="638" y="684" width="146" height="30" rx="15"/>'
    "</g>"
)

# One front wheel, centred and tucked under the apron. An autorickshaw's single
# front wheel is its clearest identifying feature after the dome.
WHEEL = (
    '<g>'
    '<circle cx="512" cy="852" r="74" fill="{kaali}"/>'
    '<circle cx="512" cy="852" r="20" fill="{peeli}"/>'
    "</g>"
)


def rickshaw(glyph_path: str, glyph_tf: str, *, bg: bool = True, bg_radius: int = 228) -> str:
    """Compose one icon. `bg=False` gives a transparent-background foreground layer."""
    parts: list[str] = []

    if bg:
        parts.append(
            f'<rect width="{SIZE}" height="{SIZE}" rx="{bg_radius}" ry="{bg_radius}" fill="{PEELI}"/>'
        )

    parts.append(MIRRORS.format(kaali=KAALI))
    # Canopy body, with the windshield knocked out via even-odd fill so the
    # yellow background shows through — one shape, no seams at any size.
    parts.append(
        f'<path d="{CANOPY} {WINDSCREEN}" fill="{KAALI}" fill-rule="evenodd"/>'
    )
    parts.append(f'<path d="{WINDSCREEN}" fill="{PEELI}"/>')
    parts.append(f'<g transform="{glyph_tf}"><path d="{glyph_path}" fill="{KAALI}"/></g>')
    parts.append(APRON.format(peeli=PEELI))
    parts.append(WHEEL.format(kaali=KAALI, peeli=PEELI))

    body = "\n  ".join(parts)
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
        f'width="{SIZE}" height="{SIZE}" role="img" aria-label="Sharing">\n  '
        f"{body}\n</svg>\n"
    )


def monochrome(glyph_path: str, glyph_tf: str) -> str:
    """Single-colour silhouette for notification icons and the Play Store's
    monochrome/themed-icon slot. Must read with no colour information at all."""
    body = "\n  ".join(
        [
            MIRRORS.format(kaali="#000000"),
            f'<path d="{CANOPY} {WINDSCREEN}" fill="#000000" fill-rule="evenodd"/>',
            f'<g transform="{glyph_tf}"><path d="{glyph_path}" fill="#000000"/></g>',
            f'<circle cx="512" cy="852" r="74" fill="#000000"/>',
        ]
    )
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {SIZE} {SIZE}" '
        f'width="{SIZE}" height="{SIZE}">\n  {body}\n</svg>\n'
    )


def splash(glyph_path: str, glyph_tf: str) -> str:
    """Splash art: the icon at rest on a black field, wordmark beneath.

    The tile keeps its yellow background here — a transparent-background icon on
    a black splash loses the whole body of the rickshaw and reads as a floating
    windscreen.
    """
    inner = rickshaw(glyph_path, glyph_tf, bg=True, bg_radius=196)
    inner_body = inner.split(">", 1)[1].rsplit("</svg>", 1)[0]
    return f"""<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" width="1024" height="1024">
  <rect width="1024" height="1024" fill="{KAALI}"/>
  <g transform="translate(281.6 236) scale(0.45)">{inner_body}</g>
  <g transform="translate(512 800)" text-anchor="middle">
    <text y="0" font-family="Inter, Roboto, system-ui, sans-serif" font-size="88"
          font-weight="800" letter-spacing="-2" fill="{PEELI}">Sharing</text>
    <text y="62" font-family="Inter, Roboto, system-ui, sans-serif" font-size="34"
          font-weight="500" letter-spacing="6" fill="#8A8175">RICKSHAW POOLING</text>
  </g>
</svg>
"""


def main() -> None:
    glyphs = json.loads((HERE / "glyphs.json").read_text(encoding="utf-8"))
    out_dir = BRAND / "icons"
    out_dir.mkdir(parents=True, exist_ok=True)

    written: list[str] = []

    for code, description in REGIONS.items():
        g = glyphs[code]
        tf = glyph_transform(g)
        d = g["d"]

        (out_dir / f"icon-{code}.svg").write_text(rickshaw(d, tf), encoding="utf-8")
        written.append(f"icons/icon-{code}.svg   {description}")

        if code == "hi":
            # Android adaptive icons keep art inside a 66% safe circle, so the
            # foreground layer is drawn at 72% scale on a transparent field and
            # the yellow lives in the separate background layer.
            fg = rickshaw(d, tf, bg=False)
            fg_body = fg.split(">", 1)[1].rsplit("</svg>", 1)[0]
            (out_dir / "adaptive-foreground.svg").write_text(
                f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" '
                f'width="1024" height="1024">\n'
                f'  <g transform="translate(143.36 143.36) scale(0.72)">{fg_body}</g>\n'
                f"</svg>\n",
                encoding="utf-8",
            )
            (out_dir / "adaptive-background.svg").write_text(
                f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024" '
                f'width="1024" height="1024"><rect width="1024" height="1024" '
                f'fill="{PEELI}"/></svg>\n',
                encoding="utf-8",
            )
            (out_dir / "icon-monochrome.svg").write_text(monochrome(d, tf), encoding="utf-8")
            (out_dir / "splash.svg").write_text(splash(d, tf), encoding="utf-8")
            written += [
                "icons/adaptive-foreground.svg   Android adaptive foreground (72% safe zone)",
                "icons/adaptive-background.svg   Android adaptive background",
                "icons/icon-monochrome.svg       Themed / notification icon",
                "icons/splash.svg                Splash screen",
            ]

    print("Built:")
    for line in written:
        print("  " + line)


if __name__ == "__main__":
    main()
