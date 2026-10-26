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
const item = (id) => mock.db.items.find((i) => i.id === id);

function set(name, value) {
  const el = form().querySelector(`[name="${name}"]`);
  el.value = value;
  el.dispatchEvent(new Event(el.tagName === 'SELECT' ? 'change' : 'input', { bubbles: true }));
}
const openFor = (sku) => rowFor(sku).querySelector('[data-action="movement"]').click();

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

describe('Record movement dialog', () => {
  test('assignable items offer Assign, Return, Receive, default Assign, and show availability', async () => {
    await openPage();
    openFor('LAP-001');
    expect(dialog().querySelector('h2').textContent).toBe('Record movement');
    expect(dialog().querySelector('.muted').textContent).toBe('Dell Latitude 5420 · LAP-001');
    expect([...form().querySelectorAll('#m-action option')].map((o) => o.textContent)).toEqual(['Assign', 'Return', 'Receive']);
    expect(form().querySelector('#m-action').value).toBe('assign');
    expect(form().querySelector('.modal-hint').textContent).toBe('6 total · 4 available · 2 assigned');
    expect($('m-person-label').textContent).toContain('Assigned to');
    expect(form().querySelector('[data-person]').hidden).toBe(false);
  });

  test('stocked items offer Issue, Restock, Receive, default Restock, with no "who?" field for restock', async () => {
    await openPage();
    openFor('SSD-001');
    expect([...form().querySelectorAll('#m-action option')].map((o) => o.textContent)).toEqual(['Issue', 'Restock', 'Receive']);
    expect(form().querySelector('#m-action').value).toBe('restock');
    expect(form().querySelector('.modal-hint').textContent).toBe('3 in stock · reorder level 5');
    expect(form().querySelector('[data-person]').hidden).toBe(true);
    set('action', 'issue');
    expect(form().querySelector('[data-person]').hidden).toBe(false);
    expect($('m-person-label').textContent).toBe('Issued for');
    set('action', 'receive');
    expect(form().querySelector('[data-person]').hidden).toBe(true);
  });

  test('blocks over-assigning and a missing person, and sends nothing', async () => {
    await openPage();
    openFor('LAP-001');
    set('quantity', '5');
    form().requestSubmit();
    expect($('err-quantity').textContent).toContain('Only 4 available to assign.');
    expect($('err-person').textContent).toContain('Enter who the item is assigned to.');
    expect(document.activeElement).toBe($('m-quantity'));
    expect(calls('PATCH')).toHaveLength(0);
    expect(calls('POST')).toHaveLength(0);
  });

  test('assigning PATCHes assignedQuantity only, adds a movement, and updates the row', async () => {
    await openPage();
    openFor('LAP-001');
    set('quantity', '2');
    set('person', 'Kevin Otieno');
    set('note', 'Sales laptops');
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(calls('PATCH').at(-1).body).toEqual({ assignedQuantity: 4 });
    expect(item(1)).toMatchObject({ quantity: 6, assignedQuantity: 4 });
    expect(mock.db.movements.at(-1)).toMatchObject({ itemId: 1, action: 'assign', quantity: 2, person: 'Kevin Otieno', note: 'Sales laptops' });
    await waitFor(() => rowFor('LAP-001').textContent.includes('4 assigned'));
    expect(document.querySelector('.toast').textContent).toBe('Movement recorded.');
  });

  test('returning cannot exceed the assigned units, and a valid return lowers them', async () => {
    await openPage();
    openFor('MSE-001');
    set('action', 'return');
    set('quantity', '9');
    form().requestSubmit();
    expect($('err-quantity').textContent).toContain('Only 8 currently assigned.');
    set('quantity', '3');
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(item(3).assignedQuantity).toBe(5);
    expect(mock.db.movements.at(-1)).toMatchObject({ action: 'return', quantity: 3 });
  });

  test('restocking raises the quantity and clears the low-stock badge', async () => {
    await openPage();
    expect(rowFor('SSD-001').querySelector('.badge-warning')).not.toBeNull();
    openFor('SSD-001');
    set('quantity', '10');
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(calls('PATCH').at(-1).body).toEqual({ quantity: 13 });
    expect(mock.db.movements.at(-1)).toMatchObject({ action: 'restock', quantity: 10, person: '' });
    await waitFor(() => rowFor('SSD-001').querySelector('.badge-success'));
  });

  test('issuing cannot exceed the stock, and issuing everything is allowed', async () => {
    await openPage();
    openFor('CBL-001');
    set('action', 'issue');
    set('quantity', '5');
    form().requestSubmit();
    expect($('err-quantity').textContent).toContain('Only 4 in stock.');
    set('quantity', '4');
    set('person', 'Conference room');
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(item(7).quantity).toBe(0);
    expect(mock.db.movements.at(-1)).toMatchObject({ action: 'issue', quantity: 4, person: 'Conference room' });
  });

  test('text typed into a hidden "who?" field is not saved', async () => {
    await openPage();
    openFor('SSD-001');
    set('action', 'issue');
    set('person', 'Someone');
    set('action', 'restock');
    set('quantity', '1');
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(mock.db.movements.at(-1)).toMatchObject({ action: 'restock', person: '' });
  });

  test('re-checks the latest numbers, so stale pages cannot over-assign', async () => {
    await openPage();
    openFor('LAP-001');                // the page believes 4 are available
    item(1).assignedQuantity = 5;      // someone else assigned 3 more meanwhile: only 1 left
    set('quantity', '2');
    set('person', 'Kevin');
    form().requestSubmit();
    await waitFor(() => !$('err-quantity').hidden);
    expect($('err-quantity').textContent).toContain('Only 1 available to assign.');
    expect(form().querySelector('[data-form-error]').textContent).toContain('stock figures changed');
    expect(calls('PATCH')).toHaveLength(0);
    expect(form().querySelector('[type="submit"]').disabled).toBe(false);
  });

  test('items in maintenance cannot be assigned', async () => {
    mock.db.items[0].status = 'maintenance';
    await openPage();
    openFor('LAP-001');
    set('person', 'Kevin');
    form().requestSubmit();
    expect($('err-action').textContent).toContain("Items that are in maintenance can't be assigned.");
  });

  test('a failed save keeps the dialog open and leaves the data alone', async () => {
    await openPage();
    openFor('LAP-001');
    set('person', 'Kevin');
    const real = mock.fetch;
    global.fetch = async (url, options = {}) => (options.method === 'PATCH' ? { ok: false, status: 500, text: async () => '' } : real(url, options));
    form().requestSubmit();
    await waitFor(() => !form().querySelector('[data-form-error]').hidden);
    expect(form().querySelector('[data-form-error]').textContent).toContain('Could not save the movement.');
    expect(dialog()).not.toBeNull();
    expect(item(1).assignedQuantity).toBe(2);
    expect(mock.db.movements).toHaveLength(16);
  });

  test('Cancel closes without saving', async () => {
    await openPage();
    openFor('LAP-001');
    dialog().querySelector('[data-cancel]').click();
    expect(dialog()).toBeNull();
    expect(calls('PATCH')).toHaveLength(0);
  });
});
