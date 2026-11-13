// A small SVG document builder.
//
// Text is drawn from glyph outlines (GitHub will not load fonts inside an SVG image). Each distinct glyph is
// written once in <defs> and placed with <use>, which keeps the files small.
import { layout } from './text.mjs';

export const esc = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

// Compact number formatting for attributes.
export const n = (v, places = 2) => {
  const k = 10 ** places;
  const r = Math.round(v * k) / k;
  return String(Object.is(r, -0) ? 0 : r);
};

const attrs = (o = {}) =>
  Object.entries(o)
    .filter(([, v]) => v !== undefined && v !== null && v !== false)
    .map(([k, v]) => ` ${k}="${typeof v === 'number' ? n(v) : esc(v)}"`)
    .join('');

export const rect = (x, y, w, h, a = {}) => `<rect x="${n(x)}" y="${n(y)}" width="${n(w)}" height="${n(h)}"${attrs(a)}/>`;
export const line = (x1, y1, x2, y2, a = {}) => `<line x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"${attrs(a)}/>`;
export const circle = (cx, cy, r, a = {}) => `<circle cx="${n(cx)}" cy="${n(cy)}" r="${n(r)}"${attrs(a)}/>`;
export const path = (d, a = {}) => `<path d="${d}"${attrs(a)}/>`;
export const group = (children, a = {}) => `<g${attrs(a)}>${Array.isArray(children) ? children.join('') : children}</g>`;

export class Doc {
  constructor({ width, height, title = '', desc = '' }) {
    this.width = width;
    this.height = height;
    this.title = title;
    this.desc = desc;
    this.defs = [];
    this.css = [];
    this.body = [];
    this.glyphIds = new Map();
    this.glyphDefs = [];
    this.fontIds = new Map();
  }

  def(markup) {
    this.defs.push(markup);
    return this;
  }

  style(css) {
    this.css.push(css);
    return this;
  }

  add(...markup) {
    this.body.push(...markup.flat());
    return this;
  }

  glyphId(font, glyph) {
    const key = `${font}\u0000${glyph.ch}`;
    let id = this.glyphIds.get(key);
    if (!id) {
      if (!this.fontIds.has(font)) this.fontIds.set(font, this.fontIds.size.toString(36));
      id = `g${this.fontIds.get(font)}-${glyph.ch.codePointAt(0).toString(36)}`;
      this.glyphIds.set(key, id);
      this.glyphDefs.push(`<path id="${id}" d="${glyph.d}"/>`);
    }
    return id;
  }

  // Outlined text as markup plus its metrics; nothing is appended. `y` is the baseline.
  // opts: font, size, x, y, anchor ('start' | 'middle' | 'end'), tracking (px), fill, opacity, and any extra
  // attributes for the wrapping <g> via `attrs` (class, id, ...).
  textSvg(str, { font, size, x = 0, y = 0, anchor = 'start', tracking = 0, fill, opacity, attrs: extra = {} }) {
    const l = layout(str, { font, size, tracking });
    const x0 = anchor === 'middle' ? x - l.width / 2 : anchor === 'end' ? x - l.width : x;
    const uses = l.glyphs
      .filter((g) => g.d)
      .map((g) => `<use href="#${this.glyphId(font, g)}"${g.x ? ` x="${n(g.x, 1)}"` : ''}/>`)
      .join('');
    const svg = `<g transform="translate(${n(x0)} ${n(y)}) scale(${n(l.scale, 5)} ${n(-l.scale, 5)})"${attrs({ fill, opacity, ...extra })}>${uses}</g>`;
    return { svg, x0, x1: x0 + l.width, width: l.width, capHeight: l.capHeight, xHeight: l.xHeight, ascent: l.ascent, descent: l.descent };
  }

  // Same, appended to the document. Returns the metrics.
  text(str, opts) {
    const t = this.textSvg(str, opts);
    this.body.push(t.svg);
    return t;
  }

  toString() {
    const label = this.title ? ` role="img" aria-label="${esc(this.title)}"` : '';
    const head = `<svg xmlns="http://www.w3.org/2000/svg" width="${n(this.width)}" height="${n(this.height)}" viewBox="0 0 ${n(this.width)} ${n(this.height)}"${label}>`;
    const meta = (this.title ? `<title>${esc(this.title)}</title>` : '') + (this.desc ? `<desc>${esc(this.desc)}</desc>` : '');
    const style = this.css.length ? `<style>${this.css.join('')}</style>` : '';
    const defs = `<defs>${style}${this.defs.join('')}${this.glyphDefs.join('')}</defs>`;
    return `${head}${meta}${defs}${this.body.join('')}</svg>\n`;
  }
}
