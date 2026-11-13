// Draws the profile picture: seven layers, the middle five lit, one amber point for the signal.
//
//   node scripts/avatar.mjs        -> assets/avatar.svg
//
// It is the same stack as the README hero, drawn with real blur for the glow: the avatar is uploaded as a
// PNG (assets/avatar.png), so the filter rules for SVG images on GitHub do not apply to it. After a change,
// rasterise the SVG at 1024 px and upload it under Settings -> Public profile.
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const INK = '#05070a';
const TEXT = '#eef3f7';
const CYAN = '#7fe3ff';
const AMBER = '#ffb26b';
const AMBER_LIGHT = '#ffd7b0';

const hex2rgb = (h) => [1, 3, 5].map((i) => parseInt(h.slice(i, i + 2), 16));
const mix = (a, b, k) => {
  const A = hex2rgb(a);
  const B = hex2rgb(b);
  return '#' + A.map((v, i) => Math.round(v + (B[i] - v) * k).toString(16).padStart(2, '0')).join('');
};
const f = (v) => String(Math.round(v * 100) / 100);
const pts = (a) => a.map((p) => `${f(p[0])},${f(p[1])}`).join(' ');
const poly = (a, attrs) => `<polygon points="${pts(a)}" ${attrs}/>`;
const line = (a, attrs) => `<polyline points="${pts(a)}" fill="none" ${attrs}/>`;

// Geometry: two-point perspective with the eye level on the middle plate.
const cx = 512;
const cy = 512;
const pitch = 116;
const thick = 64;
const s = 0.64; // how far the side corners are pulled towards the horizon
const half = 372;
const dot = 24;
const s2 = s / (2 - s);

const defs = [];
let gradients = 0;
const gradient = (x1, y1, x2, y2, from, to) => {
  const id = `g${(gradients += 1)}`;
  defs.push(`<linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${f(x1)}" y1="${f(y1)}" x2="${f(x2)}" y2="${f(y2)}"><stop offset="0" stop-color="${from}"/><stop offset="1" stop-color="${to}"/></linearGradient>`);
  return `url(#${id})`;
};

const plate = (k) => {
  const yc = (k - 4) * pitch;
  const y0 = yc - thick / 2;
  const y1 = yc + thick / 2;
  const face = (sign) => [[cx, cy + y0], [cx + sign * half, cy + s * y0], [cx + sign * half, cy + s * y1], [cx, cy + y1]];
  const ye = k < 4 ? y1 : y0; // the horizontal face we can see: underside above eye level, top below it
  return { left: face(-1), right: face(1), flat: [[cx, cy + ye], [cx + half, cy + s * ye], [cx, cy + s2 * ye], [cx - half, cy + s * ye]], y0, y1, ye };
};

// Lit plates are brightest in the middle and cool towards 02 and 06.
const lit = (k) => {
  const heat = [1, 0.8, 0.6][Math.abs(k - 4)];
  return { heat, l0: mix('#3fb4d8', '#e6f9ff', heat), l1: mix('#1f86a8', '#7fdcfa', heat), r0: mix('#2a9cc0', '#a8ecff', heat), r1: mix('#135f7b', '#3fb0da', heat) };
};

const body = [];
const glow = [];
for (let k = 2; k <= 6; k += 1) {
  const p = plate(k);
  const { heat } = lit(k);
  glow.push(poly(p.left, `fill="${CYAN}" fill-opacity="${f(heat)}"`), poly(p.right, `fill="${CYAN}" fill-opacity="${f(heat)}"`));
}
body.push(`<g filter="url(#glowWide)" opacity="0.2">${glow.join('')}</g>`);
body.push(`<g filter="url(#glowNear)" opacity="0.34">${glow.join('')}</g>`);

const outline = `stroke="${CYAN}" stroke-opacity="0.6" stroke-width="5" stroke-linejoin="miter"`;
for (const k of [1, 2, 3, 7, 6, 5, 4]) {
  const p = plate(k);
  const isLit = k >= 2 && k <= 6;
  if (k !== 4) {
    // the face that looks towards the middle plates picks up their light
    const amount = isLit ? [0, 0.26, 0.18][Math.abs(k - 4)] : 0.12;
    body.push(poly(p.flat, `fill="${gradient(cx, cy + p.ye, cx, cy + s2 * p.ye, mix('#06131b', CYAN, amount * 0.5), mix('#06131b', CYAN, amount))}"`));
    if (!isLit) body.push(poly(p.flat, `fill="none" stroke="${CYAN}" stroke-opacity="0.34" stroke-width="4" stroke-linejoin="miter"`));
  }
  if (isLit) {
    const c = lit(k);
    body.push(poly(p.left, `fill="${gradient(cx, 0, cx - half, 0, c.l0, c.l1)}"`));
    body.push(poly(p.right, `fill="${gradient(cx, 0, cx + half, 0, c.r0, c.r1)}"`));
    body.push(line([[cx - half, cy + s * p.y0], [cx, cy + p.y0], [cx + half, cy + s * p.y0]], `stroke="#ffffff" stroke-opacity="${f(0.5 + 0.45 * c.heat)}" stroke-width="4"`));
    body.push(line([[cx, cy + p.y0 + 2], [cx, cy + p.y1]], 'stroke="#0a2a38" stroke-opacity="0.35" stroke-width="3"'));
  } else {
    body.push(poly(p.left, 'fill="#0b151d"'), poly(p.right, 'fill="#080f15"'));
    body.push(poly(p.left, `fill="none" ${outline}`), poly(p.right, `fill="none" ${outline}`));
  }
}

// The signal: a hairline down the front edge with one amber point between 03 and 04.
const signalY = cy - pitch / 2;
const top = cy - 3 * pitch - thick / 2 - 34;
const bottom = cy + 3 * pitch + thick / 2 + 34;
body.push(line([[cx, top], [cx, bottom]], `stroke="${AMBER_LIGHT}" stroke-opacity="0.55" stroke-width="3.5"`));
body.push(`<circle cx="${cx}" cy="${f(signalY)}" r="${f(dot * 2.1)}" fill="${AMBER}" filter="url(#glowAmber)" opacity="0.85"/>`);
body.push(`<circle cx="${cx}" cy="${f(signalY)}" r="${dot}" fill="url(#amber)"/>`);

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
<title>Ritvik Dayal: seven layers, the middle five lit</title>
<defs>
<radialGradient id="field" cx="512" cy="512" r="560" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#12303f"/><stop offset="0.55" stop-color="#0b1c29"/><stop offset="1" stop-color="#08121b"/></radialGradient>
<filter id="glowNear" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="22"/></filter>
<filter id="glowWide" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="84"/></filter>
<filter id="glowAmber" x="-300%" y="-300%" width="700%" height="700%"><feGaussianBlur stdDeviation="18"/></filter>
<radialGradient id="amber" cx="0.5" cy="0.5" r="0.5"><stop offset="0" stop-color="#fff6e8"/><stop offset="0.5" stop-color="${AMBER_LIGHT}"/><stop offset="1" stop-color="${AMBER}"/></radialGradient>
${defs.join('\n')}
</defs>
<rect width="1024" height="1024" fill="${INK}"/>
<rect width="1024" height="1024" fill="url(#field)"/>
<circle cx="512" cy="512" r="499" fill="none" stroke="${TEXT}" stroke-opacity="0.16" stroke-width="4"/>
${body.join('\n')}
</svg>
`;

const out = fileURLToPath(new URL('../assets/avatar.svg', import.meta.url));
writeFileSync(out, svg);
console.log(`wrote ${out}`);
