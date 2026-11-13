#!/usr/bin/env node
// Live "signal" cards: public activity over the last twelve months and the languages of recently pushed
// repositories, drawn in the same style as the rest of the page. The workflow runs this twice a day:
//
//   node scripts/telemetry.mjs --out dist                (needs GITHUB_TOKEN; --login defaults to the repo owner)
//   node scripts/telemetry.mjs --out dist --fixture scripts/fixtures/sample.json --now 2026-11-13
//   node scripts/telemetry.mjs --out assets/fallback --placeholder
//
// No dependencies. Everything is rendered in memory before anything is written, so a failed run leaves the
// previous cards alone. An SVG shown through <img> cannot be hovered, so every value is printed, and each
// card's <desc> states the numbers in words.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { Doc, rect, line, circle, path, n } from './lib/svg.mjs';
import { measure, fontInfo } from './lib/text.mjs';
import { themes, type } from './lib/theme.mjs';

export const QUERY = `
query($login: String!) {
  user(login: $login) {
    contributionsCollection {
      contributionCalendar {
        totalContributions
        weeks { contributionDays { date contributionCount } }
      }
    }
    repositories(first: 100, ownerAffiliations: OWNER, isFork: false, privacy: PUBLIC, orderBy: { field: PUSHED_AT, direction: DESC }) {
      nodes {
        name
        pushedAt
        isArchived
        languages(first: 12, orderBy: { field: SIZE, direction: DESC }) {
          edges { size node { name } }
        }
      }
    }
  }
}`;

const DAY = 86_400_000;
const MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
const WEEKS_SHOWN = 52;
const TOP_LANGUAGES = 5;

// ---------------------------------------------------------------------------------------------- data

export function summariseActivity(calendar) {
  const weeks = (calendar?.weeks ?? []).map((w) => (w?.contributionDays ?? []).filter((d) => d && typeof d.date === 'string'));
  const days = weeks.flat().map((d) => ({ date: d.date, count: Math.max(0, Number(d.contributionCount) || 0) }));
  days.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
  const weekly = weeks
    .filter((w) => w.length)
    .map((w) => ({ start: w[0].date, total: w.reduce((sum, d) => sum + Math.max(0, Number(d.contributionCount) || 0), 0) }))
    .slice(-WEEKS_SHOWN);
  let longest = 0;
  let run = 0;
  let busiest = { date: null, count: 0 };
  let active = 0;
  for (const d of days) {
    if (d.count > 0) {
      active += 1;
      run += 1;
      if (run > longest) longest = run;
      if (d.count > busiest.count) busiest = d;
    } else {
      run = 0;
    }
  }
  const counted = days.reduce((sum, d) => sum + d.count, 0);
  const total = Number.isFinite(Number(calendar?.totalContributions)) ? Number(calendar.totalContributions) : counted;
  return { total, weekly, activeDays: active, longestStreak: longest, busiest };
}

// Whole-percent shares that add up to exactly 100 (largest remainder).
export function wholePercents(values) {
  const sum = values.reduce((a, b) => a + b, 0);
  if (!(sum > 0)) return values.map(() => 0);
  const exact = values.map((v) => (v / sum) * 100);
  const floors = exact.map(Math.floor);
  let left = 100 - floors.reduce((a, b) => a + b, 0);
  const order = exact.map((v, i) => [v - floors[i], i]).sort((a, b) => b[0] - a[0] || a[1] - b[1]);
  for (const [, i] of order) {
    if (left <= 0) break;
    floors[i] += 1;
    left -= 1;
  }
  return floors;
}

export function summariseLanguages(repos, now) {
  const since = now.getTime() - 365 * DAY;
  const bytes = new Map();
  let counted = 0;
  for (const repo of repos ?? []) {
    if (!repo || repo.isArchived) continue;
    const pushed = Date.parse(repo.pushedAt);
    if (!Number.isFinite(pushed) || pushed < since) continue;
    const edges = (repo.languages?.edges ?? []).filter((e) => e?.node?.name && Number(e.size) > 0);
    if (!edges.length) continue;
    counted += 1;
    for (const e of edges) bytes.set(e.node.name, (bytes.get(e.node.name) ?? 0) + Number(e.size));
  }
  const ranked = [...bytes.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1));
  const top = ranked.slice(0, TOP_LANGUAGES);
  const rest = ranked.slice(TOP_LANGUAGES).reduce((sum, [, size]) => sum + size, 0);
  const rows = top.map(([name, size]) => ({ name, size, other: false }));
  if (rest > 0) rows.push({ name: 'Other', size: rest, other: true });
  const shares = wholePercents(rows.map((r) => r.size));
  rows.forEach((r, i) => {
    r.percent = shares[i];
    r.label = shares[i] === 0 ? '<1%' : `${shares[i]}%`;
  });
  return { rows, repos: counted, languages: ranked.length };
}

// Keep only characters the font can draw, and shorten what will not fit.
export function fit(str, maxWidth, opts) {
  const glyphs = fontInfo(opts.font).glyphs;
  let s = [...String(str)].map((ch) => (glyphs[ch] ? ch : '?')).join('');
  if (measure(s, opts) <= maxWidth) return s;
  while (s.length > 1 && measure(`${s}…`, opts) > maxWidth) s = s.slice(0, -1);
  return `${s.trimEnd()}…`;
}

// A round number at or above `max`, and the gridline values under it.
export function niceScale(max) {
  if (!(max > 0)) return { top: 4, ticks: [2, 4] };
  const pow = 10 ** Math.floor(Math.log10(max));
  const step = [1, 2, 3, 4, 5, 6, 8, 10].map((m) => m * pow).find((v) => v >= max) ?? 10 * pow;
  const top = Math.max(2, pow === 1 && step % 2 ? step + 1 : step); // an odd single digit would halve to x.5
  return { top, ticks: [top / 2, top] };
}

const group = (v) => String(v).replace(/\B(?=(\d{3})+(?!\d))/g, ',');

// ---------------------------------------------------------------------------------------------- drawing

// Same card geometry as scripts/build.mjs: an 840-unit viewBox shown 410 px wide, the panel starting at x = 0
// with a transparent gutter on the right.
const W = 840;
const H = 536;
const PANEL = W - 16;
const PAD = 40;
const X0 = PAD;
const X1 = PANEL - PAD;
const FOOT = H - 40; // baseline of the bottom caption on both cards
const up = (s) => s.toUpperCase();
const hair = (t, extra = {}) => ({ stroke: t.hair, 'stroke-opacity': t.hairOpacity, 'stroke-width': 2, ...extra });

function frame(doc, t, caption, note, dot = false) {
  doc.add(rect(0, 0, PANEL, H, { fill: t.panel }));
  doc.add(rect(1, 1, PANEL - 2, H - 2, { fill: 'none', ...hair(t) }));
  doc.text(up(caption), { ...type('labelStrong', 18.5, { tracking: 18.5 * 0.2 }), x: X0, y: 66, fill: t.cyanText });
  if (note) {
    const m = doc.text(up(note), { ...type('label', 16.5, { tracking: 16.5 * 0.2 }), x: X1, y: 65, anchor: 'end', fill: t.muted });
    if (dot) doc.add(circle(m.x0 - 14, 59, 4.5, { fill: t.amber }));
  }
  doc.add(line(X0, 92, X1, 92, hair(t)));
}

export function activityCard(t, a, now) {
  const stamp = `${now.getUTCDate()} ${MONTHS[now.getUTCMonth()]}`;
  const busiest = a.busiest.date ? `${a.busiest.count} on ${a.busiest.date}` : 'none';
  const doc = new Doc({
    width: W,
    height: H,
    title: 'Public activity, last 12 months',
    desc: `${group(a.total)} public contributions in the last 12 months. Active on ${a.activeDays} days. Longest streak: ${a.longestStreak} days. Busiest day: ${busiest}. Weekly totals, oldest first: ${a.weekly.map((w) => w.total).join(', ') || 'none'}.`,
  });
  frame(doc, t, 'Public activity · last 12 months', `Updated ${stamp}`, true);

  const total = doc.text(group(a.total), { ...type('number', 86), x: X0 - 3, y: 182, fill: t.text });
  doc.text(up('Contributions'), { ...type('label', 18, { tracking: 18 * 0.2 }), x: total.x1 + 20, y: 182, fill: t.muted });

  // Weekly totals: one hue, a 2 px line (4 units at half size) over a 10% wash, hairline grid, one label.
  const top = 226;
  const base = 358;
  const points = a.weekly.map((w) => w.total);
  const { top: yMax, ticks } = niceScale(Math.max(0, ...points));
  const xAt = (i) => (points.length > 1 ? X0 + (i * (X1 - X0)) / (points.length - 1) : (X0 + X1) / 2);
  const yAt = (v) => base - (Math.min(v, yMax) / yMax) * (base - top);
  for (const v of ticks) {
    doc.add(line(X0, yAt(v), X1, yAt(v), hair(t, { 'stroke-width': 1.5, 'stroke-opacity': t.hairOpacity * 0.8 })));
    doc.text(group(v), { ...type('code', 16), x: X0, y: yAt(v) - 8, fill: t.muted });
  }
  doc.add(line(X0, base, X1, base, hair(t, { 'stroke-opacity': t.hairOpacity * 2 })));
  if (points.length > 1) {
    const d = points.map((v, i) => `${i ? 'L' : 'M'}${n(xAt(i))} ${n(yAt(v))}`).join('');
    doc.add(path(`${d}L${n(xAt(points.length - 1))} ${n(base)}L${n(xAt(0))} ${n(base)}Z`, { fill: t.cyan, 'fill-opacity': 0.1 }));
    doc.add(path(d, { fill: 'none', stroke: t.cyan, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }));
    const last = points.length - 1;
    const peak = points.indexOf(Math.max(...points));
    if (points[peak] > 0) {
      const label = group(points[peak]);
      const opts = type('bodyStrong', 19);
      const half = measure(label, opts) / 2;
      const lx = Math.min(Math.max(xAt(peak), X0 + half + 44), X1 - half - (peak >= last - 2 ? 18 : 0));
      doc.text(label, { ...opts, x: lx, y: Math.max(yAt(points[peak]) - 14, top - 8), anchor: 'middle', fill: t.text });
    }
    doc.add(circle(xAt(last), yAt(points[last]), 12, { fill: t.panel }));
    doc.add(circle(xAt(last), yAt(points[last]), 8, { fill: t.cyan }));
  }
  // Month names under the first week of every third month.
  let lastMonth = -1;
  let seen = 0;
  a.weekly.forEach((w, i) => {
    const month = new Date(`${w.start}T00:00:00Z`).getUTCMonth();
    if (Number.isNaN(month) || month === lastMonth) return;
    lastMonth = month;
    seen += 1;
    if (seen % 3 !== 2) return;
    const x = xAt(i);
    if (x > X1 - 60) return;
    doc.add(line(x, base, x, base + 7, hair(t, { 'stroke-opacity': t.hairOpacity * 2 })));
    doc.text(MONTHS[month], { ...type('label', 16, { tracking: 16 * 0.2 }), x, y: base + 30, fill: t.muted });
  });

  // Three figures under a rule.
  const ty = FOOT - 88;
  doc.add(line(X0, ty, X1, ty, hair(t)));
  const tiles = [
    ['Active days', group(a.activeDays), ''],
    ['Longest streak', group(a.longestStreak), a.longestStreak === 1 ? 'day' : 'days'],
    ['Most in one day', group(a.busiest.count), ''],
  ];
  const cell = (X1 - X0) / tiles.length;
  tiles.forEach(([caption, figure, unit], i) => {
    const x = X0 + i * cell + (i ? 24 : 0);
    if (i) doc.add(line(X0 + i * cell, ty + 16, X0 + i * cell, FOOT + 6, hair(t)));
    const f = doc.text(figure, { ...type('number', 44), x: x - 1, y: ty + 58, fill: t.text });
    if (unit) doc.text(up(unit), { ...type('label', 15, { tracking: 15 * 0.2 }), x: f.x1 + 10, y: ty + 58, fill: t.muted });
    doc.text(up(caption), { ...type('label', 16, { tracking: 16 * 0.2 }), x, y: ty + 88, fill: t.muted });
  });
  return doc;
}

export function languagesCard(t, l) {
  const doc = new Doc({
    width: W,
    height: H,
    title: 'Languages in repositories pushed in the last 12 months',
    desc: l.rows.length
      ? `By bytes of code across ${l.repos} public repositories pushed in the last 12 months: ${l.rows.map((r) => `${r.name} ${r.label}`).join(', ')}.`
      : 'No language data yet.',
  });
  frame(doc, t, 'Languages · repos pushed, last 12 months', 'By bytes');
  if (!l.rows.length) {
    doc.text('No languages to show yet.', { ...type('body', 27), x: X0, y: 160, fill: t.body });
    return doc;
  }
  // Ranked bars from one baseline, one hue; "Other" recedes. Names and figures stay in text colours.
  const nameOpts = type('body', 29);
  const figOpts = type('code', 20);
  const barX = 336;
  const barMax = X1 - barX - 86;
  const biggest = Math.max(...l.rows.map((r) => r.size));
  const rowH = 56;
  const firstY = 150;
  l.rows.forEach((r, i) => {
    const y = firstY + i * rowH;
    doc.text(fit(r.name, barX - X0 - 24, nameOpts), { ...nameOpts, x: X0, y, fill: r.other ? t.body : t.text });
    const w = Math.max(6, (r.size / biggest) * barMax);
    const cy = y - 10;
    const rad = Math.min(6, w / 2);
    doc.add(path(`M${n(barX)} ${n(cy - 6)}H${n(barX + w - rad)}A${n(rad)} 6 0 0 1 ${n(barX + w - rad)} ${n(cy + 6)}H${n(barX)}Z`, { fill: r.other ? t.faint : t.cyan }));
    doc.text(r.label, { ...figOpts, x: barX + w + 14, y: y - 3, fill: t.body });
  });
  doc.add(line(barX, firstY - 44, barX, firstY + (l.rows.length - 1) * rowH + 14, hair(t, { 'stroke-opacity': t.hairOpacity * 2 })));
  doc.text(up(`${l.repos} ${l.repos === 1 ? 'repo' : 'repos'} · ${l.languages} ${l.languages === 1 ? 'language' : 'languages'}`), { ...type('label', 16, { tracking: 16 * 0.2 }), x: X0, y: FOOT, fill: t.muted });
  return doc;
}

export function placeholderCard(t, caption) {
  const doc = new Doc({ width: W, height: H, title: caption, desc: 'Not generated yet.' });
  frame(doc, t, caption, null);
  doc.text(up('Signal pending'), { ...type('labelStrong', 22, { tracking: 22 * 0.3 }), x: PANEL / 2, y: H / 2 + 10, anchor: 'middle', fill: t.text });
  doc.text('Filled in by the next workflow run.', { ...type('body', 25), x: PANEL / 2, y: H / 2 + 54, anchor: 'middle', fill: t.body });
  return doc;
}

export function render(user, now) {
  const activity = summariseActivity(user?.contributionsCollection?.contributionCalendar);
  const languages = summariseLanguages(user?.repositories?.nodes, now);
  const files = {};
  for (const t of themes) {
    files[`signal-activity-${t.name}.svg`] = activityCard(t, activity, now).toString();
    files[`signal-languages-${t.name}.svg`] = languagesCard(t, languages).toString();
  }
  return files;
}

export function renderPlaceholders() {
  const files = {};
  for (const t of themes) {
    files[`signal-activity-${t.name}.svg`] = placeholderCard(t, 'Public activity · last 12 months').toString();
    files[`signal-languages-${t.name}.svg`] = placeholderCard(t, 'Languages · repos pushed, last 12 months').toString();
  }
  return files;
}

// ---------------------------------------------------------------------------------------------- fetching

async function fetchUser(login, token) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      const res = await fetch('https://api.github.com/graphql', {
        method: 'POST',
        headers: { authorization: `bearer ${token}`, 'content-type': 'application/json', 'user-agent': 'profile-telemetry' },
        body: JSON.stringify({ query: QUERY, variables: { login } }),
        signal: AbortSignal.timeout(20_000),
      });
      if (res.status >= 500 || res.status === 403 || res.status === 429) throw new Error(`GitHub API answered ${res.status}`);
      if (!res.ok) throw Object.assign(new Error(`GitHub API answered ${res.status}`), { fatal: true });
      return unwrap(await res.json(), login);
    } catch (err) {
      if (err.fatal) throw err;
      lastError = err;
      if (attempt < 3) await new Promise((resolve) => setTimeout(resolve, attempt * 3000));
    }
  }
  throw lastError;
}

export function unwrap(payload, login = 'the user') {
  if (payload?.errors?.length) throw Object.assign(new Error(`GraphQL error: ${String(payload.errors[0]?.message ?? 'unknown').slice(0, 200)}`), { fatal: true });
  const user = payload?.data?.user;
  if (!user) throw Object.assign(new Error(`no data returned for ${login}`), { fatal: true });
  return user;
}

function parseArgs(argv) {
  const args = { placeholder: false };
  for (let i = 0; i < argv.length; i += 1) {
    const a = argv[i];
    if (a === '--placeholder') args.placeholder = true;
    else if (['--out', '--login', '--fixture', '--now'].includes(a)) args[a.slice(2)] = argv[(i += 1)];
    else throw new Error(`unknown argument ${a}`);
  }
  if (!args.out) throw new Error('missing --out <dir>');
  return args;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const now = args.now ? new Date(args.now) : new Date();
  if (Number.isNaN(now.getTime())) throw new Error(`--now is not a date: ${args.now}`);
  let files;
  if (args.placeholder) {
    files = renderPlaceholders();
  } else if (args.fixture) {
    files = render(unwrap(JSON.parse(readFileSync(args.fixture, 'utf8'))), now);
  } else {
    const login = args.login || process.env.GITHUB_REPOSITORY_OWNER;
    const token = process.env.GITHUB_TOKEN;
    if (!login) throw new Error('no --login and no GITHUB_REPOSITORY_OWNER');
    if (!token) throw new Error('GITHUB_TOKEN is not set');
    files = render(await fetchUser(login, token), now);
  }
  for (const [name, svg] of Object.entries(files)) {
    if (/NaN|undefined|Infinity/.test(svg)) throw new Error(`${name}: bad number in output`);
  }
  mkdirSync(args.out, { recursive: true });
  for (const [name, svg] of Object.entries(files)) writeFileSync(join(args.out, name), svg);
  console.log(`wrote ${Object.keys(files).length} cards to ${args.out}`);
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  main().catch((err) => {
    console.error(`telemetry: ${err.message}`);
    process.exit(1);
  });
}
