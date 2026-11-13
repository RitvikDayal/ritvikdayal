// Dev-only. Turns the two brand typefaces into scripts/atlas.json: glyph outlines, advances and kerning pairs
// for the characters the profile uses. Everything else in scripts/ reads that file and needs no dependencies.
//
//   npm install && npm run atlas
//
// GitHub does not load fonts inside SVG images, so all text in the assets is drawn from these outlines.
// Archivo and JetBrains Mono are both licensed under the SIL Open Font License 1.1 (see assets/NOTICE.md).
import { createRequire } from 'node:module';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as fontkit from 'fontkit';

const require = createRequire(import.meta.url);
const archivo = (w) => require.resolve(`@fontsource/archivo/files/archivo-latin-${w}-normal.woff`);
const mono = (n) => require.resolve(`jetbrains-mono/fonts/webfonts/JetBrainsMono-${n}.woff2`);

const FONTS = {
  'archivo-300': archivo(300),
  'archivo-400': archivo(400),
  'archivo-500': archivo(500),
  'archivo-600': archivo(600),
  'archivo-700': archivo(700),
  'archivo-800': archivo(800),
  'mono-400': mono('Regular'),
  'mono-500': mono('Medium'),
  'mono-700': mono('Bold'),
};

const ASCII = Array.from({ length: 0x7e - 0x20 + 1 }, (_, i) => String.fromCodePoint(0x20 + i));
const EXTRA = [...'·×–—‘’“”…•−±°µéÉ'];
const MONO_ONLY = [...'→←↑↓↗✓●▸'];
const NO_LIGATURES = { liga: false, clig: false, dlig: false, calt: false };

const out = { fonts: {} };
for (const [name, file] of Object.entries(FONTS)) {
  const font = fontkit.openSync(file);
  const isMono = name.startsWith('mono');
  const chars = [...ASCII, ...EXTRA, ...(isMono ? MONO_ONLY : [])].filter((ch) => font.hasGlyphForCodePoint(ch.codePointAt(0)));
  const glyphs = {};
  for (const ch of chars) {
    const g = font.glyphForCodePoint(ch.codePointAt(0));
    const d = g.path.toSVG().replace(/-?\d*\.?\d+(?:e-?\d+)?/g, (m) => String(Math.round(parseFloat(m))));
    glyphs[ch] = [Math.round(g.advanceWidth), d];
  }
  const kern = {};
  if (!isMono) {
    for (const a of chars) {
      for (const b of chars) {
        const run = font.layout(a + b, NO_LIGATURES);
        if (run.glyphs.length !== 2) continue;
        const k = Math.round(run.positions[0].xAdvance - glyphs[a][0]);
        if (k) kern[a + b] = k;
      }
    }
  }
  out.fonts[name] = {
    upm: font.unitsPerEm,
    cap: font.capHeight,
    xh: font.xHeight,
    asc: font.ascent,
    desc: font.descent,
    glyphs,
    kern,
  };
  console.log(`${name}: ${chars.length} glyphs, ${Object.keys(kern).length} kerning pairs`);
}

const target = fileURLToPath(new URL('../atlas.json', import.meta.url));
writeFileSync(target, JSON.stringify(out));
console.log(`wrote ${target}`);
