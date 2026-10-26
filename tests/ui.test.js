/** @jest-environment jsdom */
import { afterEach, describe, expect, jest, test } from '@jest/globals';
import {
  badge, clearState, debounce, escapeHtml, fillSelect, renderItemRow, renderPager, renderProductCard, showEmpty,
  showError, showLoading, toast,
} from '../js/ui.js';

const laptop = { id: 1, name: 'Dell <b>Latitude</b>', sku: 'LAP-001', quantity: 8, assignedQuantity: 5, status: 'active', category: { name: 'Laptop', group: 'asset' } };
const cable = { id: 4, name: 'HDMI', sku: 'CBL-001', quantity: 4, assignedQuantity: 0, reorderLevel: 10, status: 'active', category: { name: 'Cable', group: 'consumable' } };

afterEach(() => { document.body.innerHTML = ''; jest.useRealTimers(); });

describe('escaping and badges', () => {
  test('escapeHtml neutralises HTML characters and tolerates null', () => {
    expect(escapeHtml('<a href="x">&\'</a>')).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;');
    expect(escapeHtml(null)).toBe('');
    expect(escapeHtml(undefined)).toBe('');
    expect(escapeHtml(5)).toBe('5');
  });
  test('badge escapes its label', () => {
    expect(badge('Hi <', 'success')).toBe('<span class="badge badge-success">Hi &lt;</span>');
    expect(badge('x')).toContain('badge-neutral');
  });
});

describe('renderItemRow', () => {
  test('escapes the name, shows the group and an Assign action for assignable items', () => {
    const html = renderItemRow(laptop);
    expect(html).toContain('Dell &lt;b&gt;Latitude&lt;/b&gt;');
    expect(html).toContain('<td>Asset</td>');
    expect(html).toContain('5 assigned');
    expect(html).toContain('>Assign</button>');
    expect(html).toContain('item-detail.html?id=1');
  });
  test('stocked items get Restock and a low-stock badge', () => {
    const html = renderItemRow(cable);
    expect(html).toContain('>Restock</button>');
    expect(html).toContain('badge-warning');
    expect(html).toContain('Low stock');
  });
  test('an item without a category still renders', () => {
    const html = renderItemRow({ ...laptop, category: undefined });
    expect(html).toContain('—');
  });
});

describe('page states', () => {
  test('loading, error with Retry, empty with an action, and clear', () => {
    const box = document.createElement('div');
    document.body.append(box);
    showLoading(box, 'Loading items…');
    expect(box.hidden).toBe(false);
    expect(box.querySelector('[role="status"]').textContent).toContain('Loading items…');

    const retry = jest.fn();
    showError(box, 'Boom <x>', retry);
    expect(box.querySelector('[role="alert"]').textContent).toContain('Boom <x>');
    expect(box.querySelector('x')).toBeNull();
    box.querySelector('[data-retry]').click();
    expect(retry).toHaveBeenCalledTimes(1);

    showError(box, 'No retry here');
    expect(box.querySelector('[data-retry]')).toBeNull();

    const action = jest.fn();
    showEmpty(box, 'No items found', 'Try again', 'Clear filters', action);
    expect(box.textContent).toContain('Try again');
    box.querySelector('[data-empty-action]').click();
    expect(action).toHaveBeenCalledTimes(1);
    showEmpty(box, 'Nothing');
    expect(box.querySelector('[data-empty-action]')).toBeNull();

    clearState(box);
    expect(box.hidden).toBe(true);
    expect(box.innerHTML).toBe('');
  });
  test('loading text defaults and is escaped', () => {
    const box = document.createElement('div');
    showLoading(box);
    expect(box.textContent).toContain('Loading…');
    showLoading(box, '<i>x</i>');
    expect(box.querySelector('i')).toBeNull();
  });
});

describe('toast', () => {
  test('adds a message to the toast region and removes it after a few seconds', () => {
    jest.useFakeTimers();
    document.body.innerHTML = '<div id="toast-region"></div>';
    toast('Saved.');
    toast('Failed.', 'error');
    const toasts = document.querySelectorAll('.toast');
    expect(toasts).toHaveLength(2);
    expect(toasts[0].className).toContain('toast-success');
    expect(toasts[1].className).toContain('toast-error');
    jest.advanceTimersByTime(5000);
    expect(document.querySelectorAll('.toast')).toHaveLength(0);
  });
  test('does nothing when the page has no toast region', () => {
    expect(() => toast('x')).not.toThrow();
  });
});

describe('fillSelect, debounce and renderPager', () => {
  test('fillSelect uses ids as values, escapes names and keeps the "all" choice first', () => {
    document.body.innerHTML = '<select id="s"></select>';
    const select = document.getElementById('s');
    fillSelect(select, [{ id: 1, name: 'A & B' }, { id: 2, name: 'C' }], 'All');
    expect([...select.options].map((o) => [o.value, o.textContent])).toEqual([['', 'All'], ['1', 'A & B'], ['2', 'C']]);
    fillSelect(select, [{ id: 3, name: 'Only' }]);
    expect(select.options).toHaveLength(1);
  });
  test('debounce runs only the last call after the pause', () => {
    jest.useFakeTimers();
    const fn = jest.fn();
    const slow = debounce(fn, 100);
    slow(1); slow(2); slow(3);
    expect(fn).not.toHaveBeenCalled();
    jest.advanceTimersByTime(150);
    expect(fn).toHaveBeenCalledTimes(1);
    expect(fn).toHaveBeenCalledWith(3);
  });
  test('renderPager draws numbered buttons, marks the current page and reports clicks', () => {
    const nav = document.createElement('nav');
    const onPage = jest.fn();
    renderPager(nav, { page: 2, totalPages: 3 }, onPage);
    expect([...nav.querySelectorAll('button')].map((b) => b.textContent)).toEqual(['Previous', '1', '2', '3', 'Next']);
    expect(nav.querySelector('[aria-current="page"]').textContent).toBe('2');
    nav.querySelector('[data-page="3"]').click();
    expect(onPage).toHaveBeenCalledWith(3);
    nav.querySelector('[data-page="1"]').click();
    expect(onPage).toHaveBeenLastCalledWith(1);
  });
  test('renderPager disables Previous on the first page and Next on the last, and hides itself for one page', () => {
    const nav = document.createElement('nav');
    const onPage = jest.fn();
    renderPager(nav, { page: 1, totalPages: 2 }, onPage);
    expect(nav.querySelector('[data-page="0"]').disabled).toBe(true);
    nav.querySelector('[data-page="0"]').click();
    expect(onPage).not.toHaveBeenCalled();
    renderPager(nav, { page: 2, totalPages: 2 }, onPage);
    expect(nav.querySelector('[data-page="3"]').disabled).toBe(true);
    renderPager(nav, { page: 1, totalPages: 1 }, onPage);
    expect(nav.innerHTML).toBe('');
  });
});

describe('renderProductCard', () => {
  test('shows the name, KES price and stock, and escapes everything', () => {
    const html = renderProductCard({ name: 'Yoga <i>', unitCost: 103199, suppliedStock: 14, imageUrl: 'https://x/y.webp' }, 3).replace(/\u00a0/g, ' ');
    expect(html).toContain('Yoga &lt;i&gt;');
    expect(html).toContain('KES 103,199');
    expect(html).toContain('In stock: 14');
    expect(html).toContain('data-index="3"');
    expect(html).toContain('<img src="https://x/y.webp"');
  });
  test('without an image it shows a text placeholder', () => {
    expect(renderProductCard({ name: 'Plain', unitCost: 1, suppliedStock: 0, imageUrl: '' }, 0)).toContain('No image');
  });
});
