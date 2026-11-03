// Temporary helper for checking the colour pairs your stylesheets use against WCAG.
// Run from the project root: node contrast-check.mjs   (it reads css/base.css and css/components.css)
import fs from 'node:fs';

const base = fs.readFileSync('css/base.css', 'utf8');
const components = fs.readFileSync('css/components.css', 'utf8');

const expand = (hex) => (hex.length === 4 ? `#${[...hex.slice(1)].map((c) => c + c).join('')}` : hex);
const token = (name) => {
  const match = base.match(new RegExp(`${name}:\\s*(#[0-9a-fA-F]{3,6})`));
  return match ? expand(match[1]) : null;
};
const literal = (selectorPattern, property) => {
  const match = components.match(new RegExp(`${selectorPattern}\\s*\\{[^}]*?${property}:\\s*(#[0-9a-fA-F]{3,6})`));
  return match ? expand(match[1]) : null;
};

const channel = (value) => {
  const v = value / 255;
  return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4;
};
const luminance = (hex) => 0.2126 * channel(parseInt(hex.slice(1, 3), 16))
  + 0.7152 * channel(parseInt(hex.slice(3, 5), 16))
  + 0.0722 * channel(parseInt(hex.slice(5, 7), 16));
const ratio = (a, b) => {
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high + 0.05) / (low + 0.05);
};

const c = {
  primary: token('--primary'), accent: token('--accent'), accentText: token('--accent-text'), support: token('--support'),
  white: token('--white'), bg: token('--bg'), border: token('--border'), borderStrong: token('--border-strong'),
  text: token('--text'), muted: token('--muted'),
  warnText: literal('\\.badge-warning', 'color'), hover: literal('\\.btn-primary:hover', 'background'),
  errorBg: literal('\\.form-error', 'background'),
};

// [description, foreground, background, minimum ratio]. 4.5 = normal text, 3 = large text and UI parts.
const checks = [
  ['Body text on white', c.text, c.white, 4.5],
  ['Body text on page background', c.text, c.bg, 4.5],
  ['Muted text on white', c.muted, c.white, 4.5],
  ['Muted text on page background', c.muted, c.bg, 4.5],
  ['Headings and links (primary) on white', c.primary, c.white, 4.5],
  ['Links (primary) on page background', c.primary, c.bg, 4.5],
  ['White on primary (buttons, sidebar)', c.white, c.primary, 4.5],
  ['White on primary hover', c.white, c.hover, 4.5],
  ['White on support colour (Available badge)', c.white, c.support, 4.5],
  ['Support colour text on white', c.support, c.white, 4.5],
  ['Dark text on accent (Low stock badge)', c.warnText, c.accent, 4.5],
  ['Error text on white', c.accentText, c.white, 4.5],
  ['Error text on error banner', c.accentText, c.errorBg, 4.5],
  ['Error text on page background', c.accentText, c.bg, 4.5],
  ['Text on grey badge', c.text, c.border, 4.5],
  ['Focus ring (primary) on white', c.primary, c.white, 3],
  ['Focus ring (white) on the sidebar', c.white, c.primary, 3],
  ['Form-field border on white', c.borderStrong ?? c.border, c.white, 3],
  ['Form-field border on page background', c.borderStrong ?? c.border, c.bg, 3],
  ['Invalid-field border on white', c.accentText, c.white, 3],
];

let failures = 0;
for (const [label, fg, bg, min] of checks) {
  if (!fg || !bg) { console.log(`SKIP  ${label} (colour not found in your CSS)`); continue; }
  const value = ratio(fg, bg);
  const ok = value >= min;
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${value.toFixed(2).padStart(5)}:1  needs ${String(min).padEnd(3)}  ${label}  (${fg} on ${bg})`);
}
console.log(failures === 0 ? '\nAll colour pairs pass.' : `\n${failures} pair(s) fail. Darken the foreground or lighten the background until the ratio reaches the "needs" value.`);
process.exit(failures === 0 ? 0 : 1);
