/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createMockApi, loadPage, polyfillDialog, waitFor } from './helpers/mockApi.js';

let mock;
const $ = (id) => document.getElementById(id);
const rows = () => [...document.querySelectorAll('#items-body tr')];
const dialog = () => document.querySelector('dialog');
const form = () => document.querySelector('dialog form');
const posts = (path) => mock.calls.filter((c) => c.method === 'POST' && c.url.endsWith(path));

function fill(values) {
  Object.entries(values).forEach(([name, value]) => {
    const el = form().querySelector(`[name="${name}"]`);
    el.value = value;
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
const validValues = { name: 'Logitech K120 Keyboard', sku: 'KBD-001', categoryId: '5', quantity: '10', reorderLevel: '3', unitCost: '1800' };

async function openPage(query = '') {
  loadPage('items.html', query);
  await import('../js/pages/items.js?' + Math.random());
  await waitFor(() => rows().length > 0 || $('items-state').textContent.includes('No items'));
}

beforeEach(() => {
  jest.resetModules();
  polyfillDialog();
  mock = createMockApi();
  global.fetch = mock.fetch;
});

describe('Add item dialog', () => {
  test('opens from the + Add Item button with accessible, location-free fields', async () => {
    await openPage();
    expect(dialog()).toBeNull();
    $('add-item').click();
    expect(dialog().querySelector('h2').textContent).toBe('Add item');
    expect(dialog().getAttribute('aria-labelledby')).toBe('modal-title');
    const names = [...form().querySelectorAll('[name]')].map((e) => e.name);
    expect(names).toEqual(['name', 'sku', 'categoryId', 'status', 'quantity', 'reorderLevel', 'unitCost']);
    form().querySelectorAll('[name]').forEach((el) => {
      expect(form().querySelector(`label[for="${el.id}"]`)).not.toBeNull();
    });
    const categories = [...form().querySelectorAll('#f-categoryId option')].map((o) => o.textContent);
    expect(categories).toContain('Mouse · Accessory');
    expect(categories).toContain('Laptop · Asset');
    expect(categories).toContain('RAM Module · Component');
    expect(categories).toContain('Toner · Consumable');
    expect([...form().querySelectorAll('#f-status option')].map((o) => o.textContent)).toEqual(['Active', 'In maintenance', 'Retired']);
    expect(form().querySelector('.input-prefix span').textContent).toBe('KES');
  });

  test('opens automatically from ?add=1', async () => {
    await openPage('?add=1');
    await waitFor(() => dialog());
    expect(dialog().querySelector('h2').textContent).toBe('Add item');
  });

  test('shows inline errors on an empty submit, flags fields and focuses the first one', async () => {
    await openPage();
    $('add-item').click();
    form().requestSubmit();
    const shown = [...form().querySelectorAll('.field-error:not([hidden])')].map((e) => e.id);
    expect(shown).toEqual(['err-name', 'err-sku', 'err-categoryId', 'err-quantity', 'err-reorderLevel', 'err-unitCost']);
    expect($('err-name').textContent).toContain('Name is required.');
    expect($('f-name').getAttribute('aria-invalid')).toBe('true');
    expect(document.activeElement).toBe($('f-name'));
    expect(posts('/items')).toHaveLength(0);
  });

  test('clears a field message when the user types, and rejects duplicate SKUs and bad numbers', async () => {
    await openPage();
    $('add-item').click();
    form().requestSubmit();
    fill({ name: 'Webcam' });
    expect($('err-name').hidden).toBe(true);
    expect($('f-name').hasAttribute('aria-invalid')).toBe(false);

    fill({ ...validValues, sku: 'lap-001', quantity: '-3', unitCost: '-1' });
    form().requestSubmit();
    expect($('err-sku').textContent).toContain('already in use');
    expect($('err-quantity').hidden).toBe(false);
    expect($('err-unitCost').hidden).toBe(false);
    expect(posts('/items')).toHaveLength(0);
  });

  test('POSTs a valid item with typed values, records opening stock, refreshes the list and toasts', async () => {
    await openPage();
    expect(rows()).toHaveLength(8);
    $('add-item').click();
    fill(validValues);
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(posts('/items')[0].body).toEqual({
      name: 'Logitech K120 Keyboard', sku: 'KBD-001', categoryId: 5, quantity: 10, unitCost: 1800,
      reorderLevel: 3, status: 'active', assignedQuantity: 0,
    });
    expect(posts('/movements')[0].body).toMatchObject({ itemId: 9, action: 'receive', quantity: 10, note: 'Initial stock' });
    await waitFor(() => $('items-count').textContent.includes('of 9 items'));
    expect(document.querySelector('.toast').textContent).toBe('Item saved successfully.');
    expect($('items-count').textContent).toBe('Showing 1–8 of 9 items · 85 units');
  });

  test('a quantity of 0 saves the item without an opening stock movement', async () => {
    await openPage();
    $('add-item').click();
    fill({ ...validValues, quantity: '0' });
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(posts('/items')).toHaveLength(1);
    expect(posts('/movements')).toHaveLength(0);
  });

  test('keeps the dialog open and shows a message when the server fails', async () => {
    await openPage();
    $('add-item').click();
    fill(validValues);
    mock.failNext = true;
    form().requestSubmit();
    await waitFor(() => !form().querySelector('[data-form-error]').hidden);
    expect(form().querySelector('[data-form-error]').textContent).toContain('Could not save the item.');
    expect(dialog()).not.toBeNull();
    expect(form().querySelector('[type="submit"]').disabled).toBe(false);
    expect(form().querySelector('[type="submit"]').textContent).toBe('Save');
    expect(mock.db.items).toHaveLength(8);
  });

  test('still reports success for the item when only the movement fails', async () => {
    await openPage();
    $('add-item').click();
    fill(validValues);
    const real = mock.fetch;
    global.fetch = async (url, options) => (String(url).endsWith('/movements') ? { ok: false, status: 500, text: async () => '' } : real(url, options));
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(mock.db.items).toHaveLength(9);
    expect(document.querySelector('.toast-error').textContent).toContain('opening stock entry could not be recorded');
  });

  test('Cancel, the close button and Esc-style close all dismiss the dialog without saving', async () => {
    await openPage();
    $('add-item').click();
    dialog().querySelector('[data-cancel]').click();
    expect(dialog()).toBeNull();
    $('add-item').click();
    dialog().querySelector('[data-close]').click();
    expect(dialog()).toBeNull();
    $('add-item').click();
    dialog().close();
    expect(dialog()).toBeNull();
    expect(posts('/items')).toHaveLength(0);
  });

  test('works from the empty state', async () => {
    mock.db.items = [];
    await openPage();
    expect($('items-state').textContent).toContain('Click "+ Add Item"');
    $('add-item').click();
    fill(validValues);
    form().requestSubmit();
    await waitFor(() => rows().length === 1);
  });
});
