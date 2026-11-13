// Colour and type tokens for the two GitHub themes.
//
// Dark is the portfolio site's palette as-is: ink #05070a, text #eef3f7, cyan #7fe3ff, amber #ffb26b. The site
// has no light mode, so light is the same system on paper: ink text, accents darkened until they pass contrast.
// Every token meant for reading clears 4.5:1 against its panel; `faint` is for decoration only.
export const THEMES = {
  dark: {
    name: 'dark',
    page: '#0d1117', // GitHub's own background, for reference
    panel: '#05070a',
    text: '#eef3f7',
    body: '#adb1b5',
    muted: '#85898c',
    pageMuted: '#9aa0a6', // muted text that sits on GitHub's page, not on a panel (also clears dark dimmed)
    faint: '#575a5d',
    hair: '#eef3f7',
    hairOpacity: 0.12,
    cyan: '#7fe3ff',
    cyanText: '#7fe3ff',
    cyanSoft: '#b9e9ff',
    amber: '#ffb26b',
    onAmber: '#05070a',
    glow: 0.5, // strength of the faked light effects; they are switched off on paper
  },
  light: {
    name: 'light',
    page: '#ffffff',
    panel: '#f5f8fa',
    text: '#05070a',
    body: '#484a4d',
    muted: '#65676a',
    pageMuted: '#65676a',
    faint: '#a9adb1',
    hair: '#05070a',
    hairOpacity: 0.14,
    cyan: '#0a7d9c',
    cyanText: '#08708c',
    cyanSoft: '#0a7d9c',
    amber: '#b4560a',
    onAmber: '#ffffff',
    glow: 0,
  },
};

export const themes = Object.values(THEMES);

// Type roles. Sizes are in viewBox units; tracking is a fraction of the size, like CSS em.
export const TYPE = {
  display: { font: 'archivo-700', tracking: -0.03 },
  displayLight: { font: 'archivo-300', tracking: -0.03 },
  heading: { font: 'archivo-700', tracking: -0.02 },
  body: { font: 'archivo-400', tracking: 0 },
  bodyStrong: { font: 'archivo-600', tracking: 0 },
  label: { font: 'mono-400', tracking: 0.3 }, // set in UPPERCASE
  labelStrong: { font: 'mono-500', tracking: 0.3 },
  number: { font: 'archivo-700', tracking: -0.03 },
  code: { font: 'mono-400', tracking: 0 },
};

// Resolve a type role at a size into the options Doc.text() takes.
export const type = (role, size, extra = {}) => {
  const r = TYPE[role];
  if (!r) throw new Error(`unknown type role "${role}"`);
  return { font: r.font, size, tracking: r.tracking * size, ...extra };
};

// WCAG contrast ratio between two #rrggbb colours.
export function contrast(a, b) {
  const lum = (hex) => {
    const c = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4));
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2];
  };
  const [hi, lo] = [lum(a), lum(b)].sort((x, y) => y - x);
  return (hi + 0.05) / (lo + 0.05);
}
