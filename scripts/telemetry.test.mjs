// node --test scripts/telemetry.test.mjs
import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import { fit, niceScale, render, summariseActivity, summariseLanguages, unwrap, wholePercents } from './telemetry.mjs';

const here = (p) => fileURLToPath(new URL(p, import.meta.url));
const fixture = (name) => JSON.parse(readFileSync(here(`./fixtures/${name}.json`), 'utf8'));
const NOW = new Date('2026-11-13T00:00:00Z');
const day = (date, contributionCount) => ({ date, contributionCount });

test('activity: streak, active days, busiest day, total', () => {
  const a = summariseActivity({
    totalContributions: 12,
    weeks: [
      { contributionDays: [day('2026-01-04', 1), day('2026-01-05', 2), day('2026-01-06', 0), day('2026-01-07', 3)] },
      { contributionDays: [day('2026-01-11', 1), day('2026-01-12', 5), day('2026-01-13', 0)] },
    ],
  });
  assert.equal(a.total, 12);
  assert.equal(a.activeDays, 5);
  assert.equal(a.longestStreak, 3); // 7th, 11th, 12th: streaks run across week boundaries
  assert.deepEqual(a.busiest, { date: '2026-01-12', count: 5 });
  assert.deepEqual(a.weekly.map((w) => w.total), [6, 6]);
});

test('activity: keeps the last 52 weeks and survives missing data', () => {
  assert.equal(summariseActivity(fixture('sample').data.user.contributionsCollection.contributionCalendar).weekly.length, 52);
  const none = summariseActivity(undefined);
  assert.deepEqual([none.total, none.activeDays, none.longestStreak, none.weekly.length], [0, 0, 0, 0]);
});

test('percentages are whole and add up to 100', () => {
  assert.deepEqual(wholePercents([1, 1, 1]), [34, 33, 33]);
  assert.equal(wholePercents([912, 640, 136, 61, 88, 52]).reduce((a, b) => a + b, 0), 100);
  assert.deepEqual(wholePercents([0, 0]), [0, 0]);
});

test('languages: only recent, unarchived repos; top five plus Other; tiny shares say <1%', () => {
  const l = summariseLanguages(fixture('sample').data.user.repositories.nodes, NOW);
  assert.equal(l.repos, 5); // the 2025 repo and the archived one are left out
  assert.deepEqual(l.rows.map((r) => r.name), ['C#', 'Python', 'HTML', 'JavaScript', 'TypeScript', 'Other']);
  assert.equal(l.rows.reduce((sum, r) => sum + r.percent, 0), 100);
  assert.ok(!l.rows.some((r) => r.name === 'Go'));
  const edge = summariseLanguages(fixture('edge').data.user.repositories.nodes, NOW);
  assert.ok(edge.rows.some((r) => r.label === '<1%'));
  assert.deepEqual(summariseLanguages(null, NOW).rows, []);
});

test('names are cut to fit and never carry characters the font lacks', () => {
  const opts = { font: 'archivo-400', size: 29, tracking: 0 };
  assert.equal(fit('Python', 300, opts), 'Python');
  assert.match(fit('A language with an exceedingly long name indeed', 250, opts), /…$/);
  assert.equal(fit('Ελλ', 300, opts), '???');
});

test('scales are round and never zero', () => {
  assert.deepEqual(niceScale(21), { top: 30, ticks: [15, 30] });
  assert.deepEqual(niceScale(0), { top: 4, ticks: [2, 4] });
  assert.deepEqual(niceScale(5120), { top: 6000, ticks: [3000, 6000] });
  assert.deepEqual(niceScale(1), { top: 2, ticks: [1, 2] });
  assert.deepEqual(niceScale(3), { top: 4, ticks: [2, 4] });
  assert.deepEqual(niceScale(5), { top: 6, ticks: [3, 6] });
  for (let max = 1; max <= 5000; max += 1) {
    const { top, ticks } = niceScale(max);
    assert.ok(top >= max && ticks.every(Number.isInteger), `scale for ${max}`);
  }
});

for (const name of ['sample', 'empty', 'edge']) {
  test(`renders ${name}: four well-formed cards, no text elements, nothing outside the canvas`, () => {
    const files = render(fixture(name).data.user, NOW);
    assert.equal(Object.keys(files).length, 4);
    for (const [file, svg] of Object.entries(files)) {
      assert.ok(!/NaN|undefined|Infinity/.test(svg), `${file}: bad number`);
      assert.ok(!/<text|<script|<foreignObject|<image|href="http/.test(svg), `${file}: forbidden content`);
      assert.ok(!/alert\(1\)<\/script>/.test(svg.replace(/<desc>.*?<\/desc>/s, '')), `${file}: raw markup leaked`);
      // every tag closes: a small stack check is enough for generated markup
      const stack = [];
      for (const m of svg.matchAll(/<(\/?)([a-zA-Z]+)[^>]*?(\/?)>/g)) {
        if (m[3]) continue;
        if (m[1]) assert.equal(stack.pop(), m[2], `${file}: mismatched </${m[2]}>`);
        else stack.push(m[2]);
      }
      assert.deepEqual(stack, [], `${file}: unclosed tags`);
      for (const m of svg.matchAll(/translate\((-?[\d.]+) (-?[\d.]+)\)/g)) {
        assert.ok(+m[1] >= 0 && +m[1] <= 824 && +m[2] >= 0 && +m[2] <= 536, `${file}: text placed off-canvas at ${m[0]}`);
      }
    }
  });
}

test('a GraphQL error or a missing user is a failure, and nothing is written', () => {
  assert.throws(() => unwrap({ errors: [{ message: 'nope' }] }), /GraphQL error: nope/);
  assert.throws(() => unwrap({ data: { user: null } }), /no data returned/);
  const dir = mkdtempSync(join(tmpdir(), 'telemetry-'));
  for (const [i, body] of ['{"errors":[{"message":"rate limited"}]}', '{"data":{"user":null}}', 'not json'].entries()) {
    const bad = join(dir, `bad-${i}.json`);
    writeFileSync(bad, body);
    const out = join(dir, `out-${i}`);
    const run = spawnSync(process.execPath, [here('./telemetry.mjs'), '--out', out, '--fixture', bad], { encoding: 'utf8' });
    assert.equal(run.status, 1);
    assert.match(run.stderr, /^telemetry: /);
    assert.throws(() => readdirSync(out), /ENOENT/);
  }
});

test('without a token the live path refuses to run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'telemetry-'));
  const run = spawnSync(process.execPath, [here('./telemetry.mjs'), '--out', join(dir, 'out'), '--login', 'someone'], { encoding: 'utf8', env: { PATH: process.env.PATH } });
  assert.equal(run.status, 1);
  assert.match(run.stderr, /GITHUB_TOKEN is not set/);
});

test('the placeholder cards build', () => {
  const dir = mkdtempSync(join(tmpdir(), 'telemetry-'));
  execFileSync(process.execPath, [here('./telemetry.mjs'), '--placeholder', '--out', dir]);
  assert.equal(readdirSync(dir).length, 4);
});
