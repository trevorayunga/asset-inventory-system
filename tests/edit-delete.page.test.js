/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createMockApi, loadPage, polyfillDialog, waitFor } from './helpers/mockApi.js';

let mock;
const $ = (id) => document.getElementById(id);
const rows = () => [...document.querySelectorAll('#items-body tr')];
const rowFor = (sku) => rows().find((r) => r.textContent.includes(sku));
const dialog = () => document.querySelector('dialog');
const form = () => document.querySelector('dialog form');
const calls = (method) => mock.calls.filter((c) => c.method === method);

function set(name, value) {
  const el = form().querySelector(`[name="${name}"]`);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
}

async function openPage() {
  loadPage('items.html');
  await import('../js/pages/items.js?' + Math.random());
  await waitFor(() => rows().length === 8);
}

beforeEach(() => {
  jest.resetModules();
  polyfillDialog();
  mock = createMockApi();
  global.fetch = mock.fetch;
});

describe('Edit item', () => {
  test('opens pre-filled, titled with the item, and shows no errors', async () => {
    await openPage();
    rowFor('LAP-001').querySelector('[data-action="edit"]').click();
    expect(dialog().querySelector('h2').textContent).toBe('Edit item');
    expect(dialog().querySelector('.muted').textContent).toBe('Dell Latitude 5420 · LAP-001');
    const v = (n) => form().querySelector(`[name="${n}"]`).value;
    expect([v('name'), v('sku'), v('categoryId'), v('status'), v('quantity'), v('reorderLevel'), v('unitCost')])
      .toEqual(['Dell Latitude 5420', 'LAP-001', '1', 'active', '6', '2', '95000']);
    expect(form().querySelectorAll('.field-error:not([hidden])')).toHaveLength(0);
    expect(form().querySelector('#hint-quantity').textContent).toContain('adds no history entry');
  });

  test('saves with PUT (full record, no expanded category), keeps assignedQuantity and refreshes the row', async () => {
    await openPage();
    rowFor('LAP-001').querySelector('[data-action="edit"]').click();
    set('name', 'Dell Latitude 5420 (refurbished)');
    set('unitCost', '90000');
    form().requestSubmit();
    await waitFor(() => !dialog());
    const put = calls('PUT')[0];
    expect(put.url).toContain('/items/1');
    expect(put.body).toEqual({
      name: 'Dell Latitude 5420 (refurbished)', sku: 'LAP-001', categoryId: 1, quantity: 6,
      assignedQuantity: 2, unitCost: 90000, reorderLevel: 2, status: 'active',
    });
    expect('category' in put.body).toBe(false);
    expect(calls('POST')).toHaveLength(0);
    await waitFor(() => rowFor('LAP-001').textContent.includes('refurbished'));
    expect(rowFor('LAP-001').textContent).toContain('2 assigned');
    expect(document.querySelector('.toast').textContent).toBe('Item updated successfully.');
  });

  test('blocks quantity below assigned units, another item\'s SKU and moving assigned items to a stocked category', async () => {
    await openPage();
    rowFor('LAP-001').querySelector('[data-action="edit"]').click();
    set('quantity', '1');
    set('sku', 'prj-001');
    set('categoryId', '8');
    form().requestSubmit();
    expect($('err-quantity').textContent).toContain('2 units already assigned');
    expect($('err-sku').textContent).toContain('already in use');
    expect($('err-categoryId').textContent).toContain('must stay an asset or accessory');
    expect(calls('PUT')).toHaveLength(0);
  });

  test('allows an unchanged SKU, and Cancel saves nothing', async () => {
    await openPage();
    rowFor('SSD-001').querySelector('[data-action="edit"]').click();
    dialog().querySelector('[data-cancel]').click();
    expect(dialog()).toBeNull();
    expect(calls('PUT')).toHaveLength(0);
    rowFor('SSD-001').querySelector('[data-action="edit"]').click();
    set('quantity', '9');
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(mock.db.items.find((i) => i.sku === 'SSD-001').quantity).toBe(9);
    await waitFor(() => rowFor('SSD-001').querySelector('.badge-success'));
  });

  test('keeps the dialog open with a message when the server fails', async () => {
    await openPage();
    rowFor('LAP-001').querySelector('[data-action="edit"]').click();
    set('name', 'Changed');
    mock.failNext = true;
    form().requestSubmit();
    await waitFor(() => !form().querySelector('[data-form-error]').hidden);
    expect(dialog()).not.toBeNull();
    expect(form().querySelector('[type="submit"]').disabled).toBe(false);
    expect(mock.db.items[0].name).toBe('Dell Latitude 5420');
  });
});

describe('Delete item', () => {
  test('asks first, and Cancel deletes nothing', async () => {
    await openPage();
    rowFor('CBL-001').querySelector('[data-action="delete"]').click();
    expect(dialog().querySelector('h2').textContent).toBe('Delete item');
    expect(dialog().textContent).toContain('Delete "HDMI Cable 2m" and its movement history?');
    expect(dialog().querySelector('[data-cancel]').hasAttribute('autofocus')).toBe(true);
    dialog().querySelector('[data-cancel]').click();
    await waitFor(() => !dialog());
    expect(calls('DELETE')).toHaveLength(0);
    expect(rows()).toHaveLength(8);
  });

  test('confirming sends DELETE with the dependent movements, removes the row and toasts', async () => {
    await openPage();
    expect(mock.db.movements.filter((m) => m.itemId === 7)).toHaveLength(2);
    rowFor('CBL-001').querySelector('[data-action="delete"]').click();
    dialog().querySelector('[data-confirm]').click();
    await waitFor(() => rows().length === 7);
    expect(calls('DELETE')[0].url).toMatch(/\/items\/7\?_dependent=movements$/);
    expect(mock.db.movements.filter((m) => m.itemId === 7)).toHaveLength(0);
    expect(rowFor('CBL-001')).toBeUndefined();
    expect($('items-count').textContent).toBe('Showing 1–7 of 7 items · 71 units');
    expect(document.querySelector('.toast').textContent).toBe('Item deleted.');
  });

  test('warns when units are assigned', async () => {
    await openPage();
    rowFor('LAP-001').querySelector('[data-action="delete"]').click();
    expect(dialog().textContent).toContain('2 units are currently assigned.');
  });

  test('a server failure keeps the row and shows an error message', async () => {
    await openPage();
    rowFor('CBL-001').querySelector('[data-action="delete"]').click();
    mock.failNext = true;
    dialog().querySelector('[data-confirm]').click();
    await waitFor(() => document.querySelector('.toast-error'));
    expect(document.querySelector('.toast-error').textContent).toContain('Could not delete the item.');
    expect(rows()).toHaveLength(8);
  });

  test('deleting the last items shows the empty state', async () => {
    mock.db.items = mock.db.items.slice(0, 1);
    mock.db.movements = [];
    loadPage('items.html');
    await import('../js/pages/items.js?' + Math.random());
    await waitFor(() => rows().length === 1);
    rows()[0].querySelector('[data-action="delete"]').click();
    dialog().querySelector('[data-confirm]').click();
    await waitFor(() => $('items-state').textContent.includes('No items found'));
    expect($('items-table-card').hidden).toBe(true);
  });
});
