// Text layout from the glyph atlas. No dependencies: the atlas already holds outlines, advances and kerning.
import { readFileSync } from 'node:fs';

const ATLAS = JSON.parse(readFileSync(new URL('../atlas.json', import.meta.url), 'utf8')).fonts;

export const FONT_NAMES = Object.keys(ATLAS);

export function fontInfo(name) {
  const f = ATLAS[name];
  if (!f) throw new Error(`unknown font "${name}" (have: ${FONT_NAMES.join(', ')})`);
  return f;
}

// Lay a string out along a baseline. Positions are in font units; `scale` converts them to px.
// `tracking` is extra px between glyphs (negative tightens), as in CSS letter-spacing.
export function layout(str, { font, size, tracking = 0 }) {
  const f = fontInfo(font);
  const scale = size / f.upm;
  const track = tracking / scale;
  const glyphs = [];
  let x = 0;
  let prev = null;
  for (const raw of String(str)) {
    const ch = raw === '\u00a0' ? ' ' : raw; // a non-breaking space draws as a space
    const g = f.glyphs[ch];
    if (!g) {
      const cp = ch.codePointAt(0).toString(16).toUpperCase().padStart(4, '0');
      throw new Error(`font "${font}" has no glyph for ${JSON.stringify(ch)} (U+${cp}); add it in scripts/dev/make-atlas.mjs or reword`);
    }
    if (prev !== null) x += (f.kern[prev + ch] || 0) + track;
    glyphs.push({ ch, x, d: g[1] });
    x += g[0];
    prev = ch;
  }
  return {
    glyphs,
    scale,
    width: x * scale,
    capHeight: f.cap * scale,
    xHeight: f.xh * scale,
    ascent: f.asc * scale,
    descent: -f.desc * scale,
  };
}

export function measure(str, opts) {
  return layout(str, opts).width;
}

// Greedy word wrap to a pixel width. Breaks at ordinary spaces only, so a non-breaking space keeps two
// words together.
export function wrap(str, maxWidth, opts) {
  const lines = [];
  let line = '';
  for (const word of String(str).split(/[ \t\n]+/).filter(Boolean)) {
    const next = line ? `${line} ${word}` : word;
    if (line && measure(next, opts) > maxWidth) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines;
}

// The same number of lines as wrap(), but with the lines evened out, so a paragraph does not end on one word.
export function wrapBalanced(str, maxWidth, opts) {
  const greedy = wrap(str, maxWidth, opts);
  if (greedy.length < 2) return greedy;
  let lo = Math.max(...String(str).split(/[ \t\n]+/).map((w) => measure(w, opts)));
  let hi = maxWidth;
  let best = greedy;
  for (let i = 0; i < 18 && hi - lo > 1; i += 1) {
    const mid = (lo + hi) / 2;
    const lines = wrap(str, mid, opts);
    if (lines.length <= greedy.length) {
      best = lines;
      hi = mid;
    } else {
      lo = mid;
    }
  }
  return best;
}
