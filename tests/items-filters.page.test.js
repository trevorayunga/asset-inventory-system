/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createMockApi, loadPage, polyfillDialog, sleep, waitFor } from './helpers/mockApi.js';

let mock;
const $ = (id) => document.getElementById(id);
const rows = () => [...document.querySelectorAll('#items-body tr')];
const names = () => rows().map((r) => r.querySelector('td').textContent);
const skus = () => rows().map((r) => r.querySelectorAll('td')[1].textContent);

async function openPage(extraItems = 0) {
  for (let i = 0; i < extraItems; i += 1) {
    mock.db.items.push({ id: 100 + i, name: `Extra item ${String(i).padStart(2, '0')}`, sku: `EXT-${i}`, categoryId: 8, quantity: 20, assignedQuantity: 0, unitCost: 50, reorderLevel: 2, status: 'active' });
  }
  loadPage('items.html');
  await import('../js/pages/items.js?' + Math.random());
  await waitFor(() => rows().length > 0);
}
async function setFilter(id, value, wait = 260) {
  const el = $(id);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(wait);
}

beforeEach(() => {
  jest.resetModules();
  polyfillDialog();
  mock = createMockApi();
  global.fetch = mock.fetch;
});

describe('Items page: search, filter and sort', () => {
  test('fills the category list from the API, with an "All categories" first choice', async () => {
    await openPage();
    const options = [...$('filter-category').options].map((o) => o.textContent);
    expect(options).toEqual(['All categories', 'Laptop', 'Projector', 'Monitor', 'Mouse', 'Keyboard', 'RAM Module', 'Storage Drive', 'Cable', 'Toner']);
    expect($('filter-category').options[4].value).toBe('4');
  });

  test('search matches names and SKUs while typing, and updates the count line', async () => {
    await openPage();
    await setFilter('filter-search', 'mouse');
    expect(names().sort()).toEqual(['HP X1000 Wired Mouse', 'Logitech M185 Wireless Mouse']);
    expect($('items-count').textContent).toBe('Showing 1–2 of 2 items · 35 units');
    await setFilter('filter-search', 'ssd-001');
    expect(skus()).toEqual(['SSD-001']);
    await setFilter('filter-search', '');
    expect(rows()).toHaveLength(8);
  });

  test('category, group and status filters work alone and together', async () => {
    await openPage();
    await setFilter('filter-category', '4', 0);
    expect(rows()).toHaveLength(2);
    await setFilter('filter-category', '', 0);
    await setFilter('filter-group', 'consumable', 0);
    expect(skus().sort()).toEqual(['CBL-001', 'TON-001']);
    await setFilter('filter-group', '', 0);
    await setFilter('filter-status', 'low', 0);
    expect(skus().sort()).toEqual(['CBL-001', 'SSD-001']);
    await setFilter('filter-status', 'assigned', 0);
    expect(rows()).toHaveLength(4);
    await setFilter('filter-group', 'accessory', 0);
    expect(skus().sort()).toEqual(['MSE-001', 'MSE-002']);
  });

  test('the sort menu reorders the table', async () => {
    await openPage();
    expect(names()[0]).toBe('Dell Latitude 5420');
    await setFilter('filter-sort', 'name-desc', 0);
    expect(names()[0]).toBe('Samsung 970 EVO 500GB SSD');
    await setFilter('filter-sort', 'quantity-desc', 0);
    expect(names()[0]).toBe('Logitech M185 Wireless Mouse');
    await setFilter('filter-sort', 'cost-desc', 0);
    expect(names()[0]).toBe('Dell Latitude 5420');
  });

  test('shows a helpful message when nothing matches, and "Clear filters" restores the list', async () => {
    await openPage();
    await setFilter('filter-search', 'no such thing');
    expect($('items-state').textContent).toContain('No items found');
    expect($('items-state').textContent).toContain('Try another search or clear your filters.');
    expect($('items-table-card').hidden).toBe(true);
    $('items-state').querySelector('[data-empty-action]').click();
    expect(rows()).toHaveLength(8);
    expect($('filter-search').value).toBe('');
    expect($('items-table-card').hidden).toBe(false);
  });

  test('pressing Enter in the search box does not submit the form', async () => {
    await openPage();
    const event = new Event('submit', { bubbles: true, cancelable: true });
    $('filters').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  test('keeps the filters after a change refreshes the list', async () => {
    await openPage();
    await setFilter('filter-group', 'accessory', 0);
    expect(rows()).toHaveLength(2);
    rows()[0].querySelector('[data-action="movement"]').click();
    const form = document.querySelector('dialog form');
    form.querySelector('[name="person"]').value = 'Front desk';
    form.requestSubmit();
    await waitFor(() => !document.querySelector('dialog'));
    await sleep(50);
    expect(rows()).toHaveLength(2);
    expect($('filter-group').value).toBe('accessory');
  });
});

describe('Items page: pagination', () => {
  test('splits more than 8 items into pages with a working pager', async () => {
    await openPage(5); // 13 items
    expect(rows()).toHaveLength(8);
    expect($('items-count').textContent).toMatch(/^Showing 1–8 of 13 items/);
    const buttons = [...$('items-pager').querySelectorAll('button')].map((b) => b.textContent);
    expect(buttons).toEqual(['Previous', '1', '2', 'Next']);
    expect($('items-pager').querySelector('[data-page="0"]').disabled).toBe(true);
    expect($('items-pager').querySelector('[aria-current="page"]').textContent).toBe('1');

    $('items-pager').querySelector('[data-page="2"]').click();
    expect(rows()).toHaveLength(5);
    expect($('items-count').textContent).toMatch(/^Showing 9–13 of 13 items/);
    expect($('items-pager').querySelector('[aria-current="page"]').textContent).toBe('2');
    expect($('items-pager').querySelector('[data-page="3"]').disabled).toBe(true);

    $('items-pager').querySelector('[data-page="1"]').click();
    expect(rows()).toHaveLength(8);
  });

  test('changing a filter returns to page 1, and a short list hides the pager', async () => {
    await openPage(5);
    $('items-pager').querySelector('[data-page="2"]').click();
    await setFilter('filter-search', 'extra');
    expect($('items-count').textContent).toMatch(/^Showing 1–5 of 5 items/);
    expect($('items-pager').innerHTML).toBe('');
  });

  test('deleting the last item on the final page moves back a page', async () => {
    await openPage(1); // 9 items: page 2 has exactly one
    $('items-pager').querySelector('[data-page="2"]').click();
    expect(rows()).toHaveLength(1);
    rows()[0].querySelector('[data-action="delete"]').click();
    document.querySelector('dialog [data-confirm]').click();
    await waitFor(() => rows().length === 8);
    expect($('items-count').textContent).toMatch(/^Showing 1–8 of 8 items/);
  });
});
