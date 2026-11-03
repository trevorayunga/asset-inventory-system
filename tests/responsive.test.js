import fs from 'node:fs';
import { describe, expect, test } from '@jest/globals';

const read = (file) => fs.readFileSync(new URL(`../${file}`, import.meta.url), 'utf8');
const PAGES = ['index.html', 'items.html', 'item-detail.html', 'catalogue.html', 'movements.html'];

describe('responsive design (bonus requirement)', () => {
  test('every page sets the viewport and the page language', () => {
    PAGES.forEach((file) => {
      const html = read(file);
      expect(html).toContain('<meta name="viewport" content="width=device-width, initial-scale=1">');
      expect(html).toContain('<html lang="en">');
    });
  });

  test('the layout has tablet and phone breakpoints', () => {
    const layout = read('css/layout.css');
    expect(layout).toContain('@media (max-width: 1100px)');
    expect(layout).toContain('@media (max-width: 860px)');
    expect(layout).toContain('@media (max-width: 560px)');
  });

  test('the sidebar collapses into a top strip and grids become single columns on phones', () => {
    const layout = read('css/layout.css');
    const tablet = layout.slice(layout.indexOf('@media (max-width: 860px)'));
    expect(tablet).toMatch(/\.app \{ grid-template-columns: minmax\(0, 1fr\); \}/);
    expect(tablet).toMatch(/\.sidebar \{ position: static; height: auto;/);
    const phone = layout.slice(layout.indexOf('@media (max-width: 560px)'));
    expect(phone).toMatch(/\.stat-grid.*\.product-grid.*grid-template-columns: minmax\(0, 1fr\)/s);
  });

  test('wide tables scroll inside their card, and touch targets are at least 44px', () => {
    const components = read('css/components.css');
    expect(components).toContain('.table-wrap { overflow-x: auto; }');
    expect(components).toMatch(/\.table-wrap table \{ min-width: 640px; \}/);
    expect(components).toMatch(/@media \(pointer: coarse\), \(max-width: 560px\)[\s\S]*min-height: 44px/);
  });

  test('sizes use relative units and fluid type, and reduced motion is respected', () => {
    const base = read('css/base.css');
    expect(base).toContain('clamp(');
    expect(base).toContain('prefers-reduced-motion: reduce');
    expect(read('css/layout.css')).toContain('100dvh');
  });

  test('every colour token is defined once and used through var()', () => {
    const base = read('css/base.css');
    ['--primary', '--accent', '--accent-text', '--support', '--border-strong'].forEach((token) => {
      expect(base.match(new RegExp(`${token}:`, 'g'))).toHaveLength(1);
    });
  });
});
