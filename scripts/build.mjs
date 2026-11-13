// Builds the README's static SVG assets into assets/, each in a dark and a light variant.
//
//   npm run build        (plain Node 20+, no dependencies)
//
// What the page says lives in scripts/content.mjs; colours and type in scripts/lib/theme.mjs.
// Full-width assets use a 1200-unit viewBox and are shown 820 px wide; cards use 840 units and are shown
// 410 px wide, so two sit side by side on desktop and stack on a phone. Every asset keeps a transparent
// gutter on its right edge only: panels start at x = 0, in line with the README's text, and two cards placed
// with no whitespace between them end up 8 px apart.
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { Doc, rect, line, circle, path, group, n } from './lib/svg.mjs';
import { measure, wrapBalanced } from './lib/text.mjs';
import { themes, type } from './lib/theme.mjs';
import * as content from './content.mjs';

const OUT = fileURLToPath(new URL('../assets/', import.meta.url));
const FULL = 1200;
const FULL_R = FULL - 12; // right edge of full-width panels (an 8 px gutter at 820 px)
const CARD = 840;
const CARD_R = CARD - 16; // right edge of card panels (an 8 px gutter at 410 px)
const PAD = 40;
const CL = PAD; // card content, left and right
const CR = CARD_R - PAD;
const CMID = CARD_R / 2;

const up = (s) => s.toUpperCase();
const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
};
const hair = (t, extra = {}) => ({ stroke: t.hair, 'stroke-opacity': t.hairOpacity, 'stroke-width': 2, ...extra });
const toneOf = (t, tone) => (tone === 'cyan' ? t.cyan : tone === 'amber' ? t.amber : t.text);

function panel(doc, t, w, h) {
  doc.add(rect(0, 0, w, h, { fill: t.panel }));
  doc.add(rect(1, 1, w - 2, h - 2, { fill: 'none', ...hair(t) }));
}

// A number that may mix faces: strings in the number face, {mono: '→'} in JetBrains Mono.
function value(doc, t, v, { size, x, y, fill }) {
  const parts = (Array.isArray(v) ? v : [v]).map((s) =>
    typeof s === 'string' ? { str: s, ...type('number', size) } : { str: s.mono, font: 'mono-500', size: size * 0.82, tracking: 0 },
  );
  let cx = x;
  for (const p of parts) {
    doc.text(p.str, { font: p.font, size: p.size, tracking: p.tracking, x: cx, y, fill });
    cx += measure(p.str, p);
  }
  return cx - x;
}

// Outlined, square-cornered chips in a row; wraps when the row is full. Returns the y below the last row.
function chips(doc, t, labels, { x, y, maxWidth, size = 16, h = 40, gap = 10, stroke, fill }) {
  let cx = x;
  let cy = y;
  for (const label of labels) {
    const opts = type('label', size, { tracking: size * 0.22 });
    const w = measure(up(label), opts) + 28;
    if (cx > x && cx + w > x + maxWidth) {
      cx = x;
      cy += h + gap;
    }
    doc.add(rect(cx + 1, cy + 1, w - 2, h - 2, { fill: 'none', stroke: stroke ?? t.hair, 'stroke-opacity': stroke ? 0.75 : t.hairOpacity * 2.2, 'stroke-width': 2 }));
    doc.text(up(label), { ...opts, x: cx + 14, y: cy + h / 2 + size * 0.36, fill: fill ?? t.body });
    cx += w + gap;
  }
  return cy + h;
}

// ---------------------------------------------------------------------------------------------------------
// The seven-layer stack: seven plates in two-point perspective with the eye level on the middle plate, so
// plates above show their undersides and plates below show their tops. 02-06 are lit, 01 and 07 are outlines.
function stack(doc, t, { cx, cy, A, p, th, s = 0.64, id = 's' }) {
  const dark = t.name === 'dark';
  const s2 = s / (2 - s);
  const pts = (a) => a.map((q) => `${n(q[0])},${n(q[1])}`).join(' ');
  const poly = (a, at) => `<polygon points="${pts(a)}" ${at}/>`;
  const pl = (a, at) => `<polyline points="${pts(a)}" fill="none" ${at}/>`;
  let gid = 0;
  const lg = (x1, y1, x2, y2, c1, c2) => {
    const gidStr = `${id}g${++gid}`;
    doc.def(`<linearGradient id="${gidStr}" gradientUnits="userSpaceOnUse" x1="${n(x1)}" y1="${n(y1)}" x2="${n(x2)}" y2="${n(y2)}"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></linearGradient>`);
    return `url(#${gidStr})`;
  };
  const geo = (k) => {
    const yc = (k - 4) * p;
    const y0 = yc - th / 2;
    const y1 = yc + th / 2;
    const face = (sign) => [[cx, cy + y0], [cx + sign * A, cy + s * y0], [cx + sign * A, cy + s * y1], [cx, cy + y1]];
    const ye = k < 4 ? y1 : y0;
    return { left: face(-1), right: face(1), flat: [[cx, cy + ye], [cx + A, cy + s * ye], [cx, cy + s2 * ye], [cx - A, cy + s * ye]], y0, y1, ye, yc };
  };
  const lit = (k) => {
    const heat = [1, 0.8, 0.6][Math.abs(k - 4)];
    if (dark) {
      return { heat, l0: mix('#3fb4d8', '#e6f9ff', heat), l1: mix('#1f86a8', '#7fdcfa', heat), r0: mix('#2a9cc0', '#a8ecff', heat), r1: mix('#135f7b', '#3fb0da', heat) };
    }
    const base = mix('#7cc4d9', '#0a7d9c', heat);
    return { heat, l0: mix(base, '#ffffff', 0.12), l1: base, r0: mix(base, '#04303d', 0.16), r1: mix(base, '#04303d', 0.3) };
  };
  const out = [];
  if (dark) {
    doc.def(`<radialGradient id="${id}glow" cx="${n(cx)}" cy="${n(cy)}" r="${n(A * 1.9)}" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="${t.cyan}" stop-opacity="0.2"/><stop offset="0.55" stop-color="${t.cyan}" stop-opacity="0.06"/><stop offset="1" stop-color="${t.cyan}" stop-opacity="0"/></radialGradient>`);
    out.push(circle(cx, cy, A * 1.9, { fill: `url(#${id}glow)` }));
  }
  const edge = dark ? `stroke="${t.cyan}" stroke-opacity="0.6"` : `stroke="${t.text}" stroke-opacity="0.4"`;
  const sw = Math.max(1.6, A / 80);
  const paper = dark ? ['#06131b', '#0b151d', '#080f15'] : ['#eef3f6', '#e9eef2', '#e1e7ec'];
  for (const k of [1, 2, 3, 7, 6, 5, 4]) {
    const G = geo(k);
    const isLit = k >= 2 && k <= 6;
    if (k !== 4) {
      const amt = isLit ? [0, 0.26, 0.18][Math.abs(k - 4)] : 0.1;
      const tint = dark ? t.cyan : '#0a7d9c';
      out.push(poly(G.flat, `fill="${lg(cx, cy + G.ye, cx, cy + s2 * G.ye, mix(paper[0], tint, amt * 0.5), mix(paper[0], tint, amt))}"`));
      if (!isLit) out.push(poly(G.flat, `fill="none" ${edge.replace(/opacity="[\d.]+"/, `opacity="${dark ? 0.34 : 0.22}"`)} stroke-width="${n(sw * 0.8)}" stroke-linejoin="miter"`));
    }
    if (isLit) {
      const c = lit(k);
      out.push(poly(G.left, `fill="${lg(cx, 0, cx - A, 0, c.l0, c.l1)}"`));
      out.push(poly(G.right, `fill="${lg(cx, 0, cx + A, 0, c.r0, c.r1)}"`));
      out.push(pl([[cx - A, cy + s * G.y0], [cx, cy + G.y0], [cx + A, cy + s * G.y0]], `stroke="#ffffff" stroke-opacity="${n(dark ? 0.5 + 0.45 * c.heat : 0.7)}" stroke-width="${n(sw * 0.8)}"`));
    } else {
      out.push(poly(G.left, `fill="${paper[1]}"`), poly(G.right, `fill="${paper[2]}"`));
      out.push(poly(G.left, `fill="none" ${edge} stroke-width="${n(sw)}" stroke-linejoin="miter"`), poly(G.right, `fill="none" ${edge} stroke-width="${n(sw)}" stroke-linejoin="miter"`));
    }
  }
  doc.add(out);
  return { geo, s, top: cy - 3 * p - th / 2, bottom: cy + 3 * p + th / 2, rest: cy - p / 2 };
}

// ---------------------------------------------------------------------------------------------------------
function hero(t) {
  const H = 536;
  const doc = new Doc({ width: FULL, height: H, title: `${content.person.name.join(' ')} - ${content.person.title}. ${content.person.line.join(' ')}` });
  const dark = t.name === 'dark';
  const w = FULL_R;
  doc.add(rect(0, 0, w, H, { fill: t.panel }));
  if (dark) {
    doc.def(`<radialGradient id="haze" cx="${n(FULL * 0.7)}" cy="0" r="620" gradientUnits="userSpaceOnUse" gradientTransform="scale(1 0.62)"><stop offset="0" stop-color="${t.cyan}" stop-opacity="0.1"/><stop offset="1" stop-color="${t.cyan}" stop-opacity="0"/></radialGradient>`);
    doc.add(rect(0, 0, w, H, { fill: 'url(#haze)' }));
  }
  // A fine dot grid behind the stack, fading out to the left: the site's LCD field.
  doc.def(`<pattern id="dots" width="16" height="16" patternUnits="userSpaceOnUse"><rect x="7" y="7" width="2" height="2" fill="${t.text}"/></pattern>`);
  doc.def('<linearGradient id="fade" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="0.45" stop-color="#fff" stop-opacity="1"/><stop offset="1" stop-color="#fff" stop-opacity="1"/></linearGradient>');
  doc.def(`<mask id="fadeMask" maskUnits="userSpaceOnUse" x="510" y="0" width="${n(w - 510)}" height="${H}"><rect x="510" y="0" width="${n(w - 510)}" height="${H}" fill="url(#fade)"/></mask>`);
  doc.add(`<g mask="url(#fadeMask)" opacity="${dark ? 0.16 : 0.2}"><rect x="510" y="24" width="${n(w - 510 - 18)}" height="366" fill="url(#dots)"/></g>`);
  doc.add(rect(1, 1, w - 2, H - 2, { fill: 'none', ...hair(t) }));
  // The site's progress line, cyan running to amber.
  doc.def(`<linearGradient id="progress" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${t.cyan}"/><stop offset="1" stop-color="${t.amber}"/></linearGradient>`);
  doc.add(rect(0, 0, 430, 3, { fill: 'url(#progress)' }));

  const left = 58;
  doc.add(rect(left, 56, 9, 9, { fill: t.cyan }));
  doc.text(up(content.person.title), { ...type('label', 16), x: left + 24, y: 66, fill: t.muted });
  doc.text(content.person.name[0], { ...type('displayLight', 172), x: left - 8, y: 214, fill: t.text });
  doc.text(content.person.name[1], { ...type('display', 172), x: left - 8, y: 356, fill: t.cyan });

  // The stack with its seven labels.
  const cx = 800;
  const cy = 208;
  const A = 168;
  const p = 46;
  const th = 25;
  const S = stack(doc, t, { cx, cy, A, p, th });
  const lx = cx + A + 30;
  content.layers.forEach((layer, i) => {
    const y = cy + S.s * (i + 1 - 4) * p;
    doc.add(line(cx + A + 6, y, lx - 8, y, { stroke: layer.mine ? t.cyan : t.hair, 'stroke-opacity': layer.mine ? 0.7 : t.hairOpacity * 2.4, 'stroke-width': 1.5 }));
    const idx = doc.text(layer.n, { ...type('labelStrong', 14, { tracking: 14 * 0.16 }), x: lx, y: y + 5, fill: layer.mine ? t.cyanText : t.muted });
    doc.text(up(layer.name), { ...type('label', 14, { tracking: 14 * 0.22 }), x: idx.x1 + 12, y: y + 5, fill: layer.mine ? t.text : t.muted });
  });
  // "The middle five", bracketed.
  const by0 = cy + S.s * (2 - 4) * p - 12;
  const by1 = cy + S.s * (6 - 4) * p + 12;
  const bx = w - 36;
  doc.add(path(`M${n(bx - 8)} ${n(by0)}H${n(bx)}V${n(by1)}H${n(bx - 8)}`, { fill: 'none', stroke: t.cyan, 'stroke-opacity': 0.75, 'stroke-width': 1.5 }));
  const cap = doc.textSvg(up('The middle five'), { ...type('label', 12, { tracking: 12 * 0.3 }), x: 0, y: 0, anchor: 'middle', fill: t.cyanText });
  doc.add(`<g transform="translate(${n(bx + 17)} ${n((by0 + by1) / 2)}) rotate(90)">${cap.svg}</g>`);

  // The signal: one amber point travelling down the front edge and back. Its resting place is the base
  // state, so the picture is complete where animation does not run.
  const dot = 6.5;
  doc.add(line(cx, S.top - 16, cx, S.bottom + 16, { stroke: t.amber, 'stroke-opacity': dark ? 0.5 : 0.55, 'stroke-width': 1.5 }));
  doc.def(`<radialGradient id="halo"><stop offset="0" stop-color="${t.amber}" stop-opacity="${dark ? 0.7 : 0.28}"/><stop offset="1" stop-color="${t.amber}" stop-opacity="0"/></radialGradient>`);
  const down = S.bottom + 8 - S.rest;
  const upBy = S.rest - (S.top - 8);
  doc.style(`.sig{animation:sig 9s cubic-bezier(.45,0,.55,1) infinite}@keyframes sig{0%,100%{transform:translateY(0)}38%{transform:translateY(${n(down)}px)}84%{transform:translateY(${n(-upBy)}px)}}@media (prefers-reduced-motion:reduce){.sig{animation:none}}`);
  doc.add(group([circle(cx, S.rest, dot * 3.4, { fill: 'url(#halo)' }), circle(cx, S.rest, dot, { fill: dark ? '#ffd7b0' : t.amber }), circle(cx, S.rest, dot * 0.45, { fill: dark ? '#fff6e8' : '#ffffff', 'fill-opacity': dark ? 1 : 0.85 })], { class: 'sig' }));

  // The line under it all, large enough to survive a phone.
  doc.add(line(left, 408, w - left, 408, hair(t, { 'stroke-width': 1.5 })));
  doc.text(content.person.line[0], { ...type('body', 37), x: left, y: 458, fill: t.body });
  doc.text(content.person.line[1], { ...type('bodyStrong', 37), x: left, y: 504, fill: t.text });
  return doc;
}

// Section headers sit on GitHub's own background, so they use the page tones rather than the panel ones.
function header(t, sec) {
  const H = 62 + sec.headline.length * 72 + 8;
  const doc = new Doc({ width: FULL, height: H, title: `${sec.n} ${sec.label}: ${sec.headline.join(' ')}` });
  const idx = doc.text(sec.n, { ...type('labelStrong', 19), x: 0, y: 26, fill: t.cyanText });
  doc.add(line(idx.x1 + 18, 19.5, idx.x1 + 70, 19.5, { stroke: t.cyanText, 'stroke-width': 1.5 }));
  doc.text(up(sec.label), { ...type('label', 19), x: idx.x1 + 90, y: 26, fill: t.pageMuted });
  sec.headline.forEach((ln, i) => doc.text(ln, { ...type('display', 70), x: -4, y: 112 + i * 72, fill: t.text }));
  return doc;
}

function chip(t, link) {
  const size = 20;
  const opts = type('labelStrong', size, { tracking: size * 0.2 });
  const tw = measure(up(link.label), opts);
  const arrow = measure('↗', { font: 'mono-500', size: 22 });
  const W = Math.ceil(tw + arrow + 22 * 2 + 14);
  const H = 64;
  const doc = new Doc({ width: W, height: H, title: link.label });
  if (link.primary) {
    doc.add(rect(0, 0, W, H, { fill: t.cyan }));
  } else {
    doc.add(rect(1, 1, W - 2, H - 2, { fill: 'none', stroke: t.text, 'stroke-opacity': 0.34, 'stroke-width': 2 }));
  }
  const ink = link.primary ? (t.name === 'dark' ? '#05070a' : '#ffffff') : t.text;
  const a = doc.text(up(link.label), { ...opts, x: 22, y: 39, fill: ink });
  doc.text('↗', { font: 'mono-500', size: 22, x: a.x1 + 14, y: 40, fill: ink });
  return doc;
}

function statCard(t, pair) {
  const H = 236;
  const doc = new Doc({ width: CARD, height: H, title: pair.map((s) => `${s.value} ${s.caption.join(' ')}`).join('; ') });
  panel(doc, t, CARD_R, H);
  pair.forEach((s, i) => {
    const x = i * CMID + PAD;
    doc.text(s.value, { ...type('number', 86), x: x - 3, y: 118, fill: toneOf(t, s.tone) });
    s.caption.forEach((ln, j) => doc.text(up(ln), { ...type('label', 18, { tracking: 18 * 0.22 }), x, y: 166 + j * 30, fill: t.muted }));
  });
  doc.add(line(CMID, 44, CMID, H - 44, hair(t)));
  return doc;
}

// The two-cell number block shared by work and open-source cards.
function statBlock(doc, t, stats, y) {
  doc.add(line(CL, y, CR, y, hair(t)));
  doc.add(line(CMID, y + 18, CMID, y + 138, hair(t)));
  stats.forEach((s, i) => {
    const x = i === 0 ? CL : CMID + PAD * 0.8;
    value(doc, t, s.value, { size: 56, x: x - 2, y: y + 72, fill: toneOf(t, s.tone) });
    s.caption.forEach((ln, j) => doc.text(up(ln), { ...type('label', 18, { tracking: 18 * 0.18 }), x, y: y + 108 + j * 27, fill: t.muted }));
  });
}

const CARD_H = 618;

function cardHead(doc, t, { n: idx, tag, title, body, titleSize = 44 }) {
  let cx = CL;
  if (idx) {
    const i = doc.text(idx, { ...type('labelStrong', 19), x: CL, y: 70, fill: t.cyanText });
    cx = i.x1 + 16;
  }
  chips(doc, t, [tag], { x: cx, y: 42, maxWidth: 700, size: 17, h: 40, stroke: t.amber, fill: t.amber });
  const first = 98 + titleSize;
  title.forEach((ln, i) => doc.text(ln, { ...type('heading', titleSize), x: CL - 2, y: first + i * 50, fill: t.text }));
  const top = first + (title.length - 1) * 50 + 54;
  const lines = wrapBalanced(body, CR - CL, type('body', 27));
  lines.forEach((ln, i) => doc.text(ln, { ...type('body', 27), x: CL, y: top + i * 39, fill: t.body }));
}

function workCard(t, w) {
  const doc = new Doc({ width: CARD, height: CARD_H, title: `${w.title.join(' ')} (${w.tag}). ${w.body}` });
  panel(doc, t, CARD_R, CARD_H);
  cardHead(doc, t, w);
  statBlock(doc, t, w.stats, 374);
  chips(doc, t, w.chips, { x: CL, y: 536, maxWidth: CR - CL, size: 16.5, h: 40, gap: 8 });
  return doc;
}

function sourceCard(t, s) {
  const doc = new Doc({ width: CARD, height: CARD_H, title: `${s.title.join(' ')} (${s.tag}). ${s.body}` });
  panel(doc, t, CARD_R, CARD_H);
  cardHead(doc, t, { ...s, titleSize: 60 });
  // It is a link: an arrow in the top-right corner says so.
  doc.text('↗', { font: 'mono-400', size: 34, x: CR, y: 76, anchor: 'end', fill: t.cyanText });
  const y = 374;
  if (s.stats) {
    statBlock(doc, t, s.stats, y);
  } else {
    doc.add(line(CL, y, CR, y, hair(t)));
    const cellW = (CR - CL) / s.steps.length;
    s.steps.forEach((step, i) => {
      const sx = CL + i * cellW;
      if (i) doc.add(line(sx, y + 18, sx, y + 138, hair(t)));
      const px = i ? sx + 18 : sx;
      doc.text(String(i + 1).padStart(2, '0'), { ...type('labelStrong', 16.5), x: px, y: y + 54, fill: t.cyanText });
      doc.text(step, { ...type('bodyStrong', 27), x: px, y: y + 98, fill: t.text });
      if (i < s.steps.length - 1) doc.text('→', { font: 'mono-400', size: 18, x: sx + cellW - 12, y: y + 53, anchor: 'end', fill: t.muted });
    });
  }
  const by = 536;
  const bh = 46;
  doc.add(rect(CL + 1, by + 1, CR - CL - 2, bh - 2, { fill: 'none', ...hair(t, { 'stroke-opacity': t.hairOpacity * 1.8 }) }));
  if (s.codeIsProse) {
    doc.add(rect(CL, by, 4, bh, { fill: t.cyan }));
    doc.text(s.code, { ...type('bodyStrong', 23), x: CL + 22, y: by + 31, fill: t.text });
  } else {
    const d = doc.text('$', { ...type('code', 20), x: CL + 18, y: by + 30, fill: t.cyanText });
    doc.text(s.code, { ...type('code', 20), x: d.x1 + 14, y: by + 30, fill: t.text });
  }
  return doc;
}

function stackCard(t, s) {
  const rows = Math.max(...content.stack.map((c) => c.items.length));
  const H = 118 + rows * 50 + 22;
  const doc = new Doc({ width: CARD, height: H, title: `${s.title}: ${s.items.join(', ')}` });
  panel(doc, t, CARD_R, H);
  doc.text(up(s.title), { ...type('labelStrong', 18.5, { tracking: 18.5 * 0.24 }), x: CL, y: 66, fill: t.cyanText });
  doc.add(line(CL, 92, CR, 92, hair(t)));
  s.items.forEach((item, i) => doc.text(item, { ...type('body', 29), x: CL, y: 146 + i * 50, fill: t.text }));
  return doc;
}

function recognitionCard(t, r) {
  const H = 248;
  const doc = new Doc({ width: CARD, height: H, title: `${r.title.join(' ')} (${r.when}). ${r.body.join(' ')}` });
  panel(doc, t, CARD_R, H);
  doc.add(rect(0, 0, CARD_R, 3, { fill: t.amber }));
  doc.text(up(r.when), { ...type('labelStrong', 16.5, { tracking: 16.5 * 0.2 }), x: CR, y: 66, anchor: 'end', fill: t.amber });
  r.title.forEach((ln, i) => doc.text(ln, { ...type('heading', 33), x: CL, y: 72 + i * 40, fill: t.text }));
  r.body.forEach((ln, i) => doc.text(ln, { ...type('body', 25), x: CL, y: 168 + i * 34, fill: t.body }));
  return doc;
}

function footer(t) {
  const H = 244;
  const f = content.footer;
  const doc = new Doc({ width: FULL, height: H, title: `${f.headline} ${f.body.join(' ')}` });
  doc.add(line(0, 1, FULL_R, 1, hair(t, { 'stroke-opacity': t.hairOpacity * 1.6 })));
  doc.def(`<linearGradient id="progress" x1="0" x2="1" y1="0" y2="0"><stop offset="0" stop-color="${t.cyan}"/><stop offset="1" stop-color="${t.amber}"/></linearGradient>`);
  doc.add(rect(0, 0, 180, 3, { fill: 'url(#progress)' }));
  doc.text(f.headline, { ...type('display', 66), x: -4, y: 98, fill: t.text });
  f.body.forEach((ln, i) => doc.text(ln, { ...type('body', 34), x: 0, y: 160 + i * 46, fill: t.body }));
  doc.text(up(f.sign), { ...type('label', 15), x: FULL_R, y: 206, anchor: 'end', fill: t.pageMuted });
  return doc;
}

// ---------------------------------------------------------------------------------------------------------
const assets = [];
const emit = (name, make) => {
  for (const t of themes) assets.push([`${name}-${t.name}.svg`, make(t)]);
};

emit('hero', hero);
for (const sec of content.sections) emit(`head-${sec.id}`, (t) => header(t, sec));
for (const link of content.links) emit(`link-${link.id}`, (t) => chip(t, link));
content.stats.forEach((pair, i) => emit(`stats-${i + 1}`, (t) => statCard(t, pair)));
for (const w of content.work) emit(`work-${w.id}`, (t) => workCard(t, w));
for (const s of content.source) emit(`source-${s.id}`, (t) => sourceCard(t, s));
for (const s of content.stack) emit(`stack-${s.id}`, (t) => stackCard(t, s));
for (const r of content.recognition) emit(`recognition-${r.id}`, (t) => recognitionCard(t, r));
emit('footer', footer);

mkdirSync(OUT, { recursive: true });
let total = 0;
for (const [file, doc] of assets) {
  const svg = doc.toString();
  if (/NaN|undefined|Infinity/.test(svg)) throw new Error(`${file}: bad number in output`);
  writeFileSync(OUT + file, svg);
  total += svg.length;
}
console.log(`built ${assets.length} files into assets/ (${(total / 1024).toFixed(0)} KB total)`);
