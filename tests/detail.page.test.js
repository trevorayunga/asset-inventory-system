/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createMockApi, loadPage, polyfillDialog, waitFor } from './helpers/mockApi.js';

let mock;
const $ = (id) => document.getElementById(id);
const text = (id) => $(id).textContent.replace(/\u00a0/g, ' ');
const dialog = () => document.querySelector('dialog');
const form = () => document.querySelector('dialog form');

async function openPage(query = '?id=1') {
  loadPage('item-detail.html', query);
  await import('../js/pages/itemDetail.js?' + Math.random());
  await waitFor(() => !$('detail-content').hidden || $('detail-state').textContent.length > 0 && !$('detail-state').textContent.includes('Loading'));
}

beforeEach(() => {
  jest.resetModules();
  polyfillDialog();
  mock = createMockApi();
  global.fetch = mock.fetch;
});

describe('Item detail: an assignable item', () => {
  test('shows the summary, badges and facts', async () => {
    await openPage('?id=1');
    expect(text('item-title')).toBe('Dell Latitude 5420');
    expect(text('crumb-name')).toBe('Dell Latitude 5420');
    expect(text('item-kind')).toBe('Asset · Laptop');
    expect([...$('item-badges').querySelectorAll('.badge')].map((b) => b.textContent)).toEqual(['2 assigned', '4 available']);
    expect(text('d-sku')).toBe('LAP-001');
    expect(text('d-quantity')).toBe('6 total · 4 available');
    expect(text('d-cost')).toBe('KES 95,000');
    expect(text('d-assigned')).toBe('2 units assigned · latest: Maya Patel');
    expect(text('d-value')).toBe('Total value KES 570,000');
    expect(document.title).toBe('Dell Latitude 5420 | AssetTrack');
  });

  test('shows only the actions that make sense, and the history newest first', async () => {
    await openPage('?id=1');
    expect($('assign-return').hidden).toBe(false);
    expect($('restock-issue').hidden).toBe(true);
    const rows = [...document.querySelectorAll('#history-body tr')].map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent.trim()));
    expect(rows.map((r) => r.slice(1))).toEqual([['Assigned', '2', 'Maya Patel'], ['Received', '+6', 'PO-1101 · Initial stock']]);
    expect(text('history-count')).toBe('2 movements · Complete history');
    expect(text('history-note')).toBe('Assignments change availability, not total quantity.');
  });

  test('Assign / Return offers just those two actions and refreshes the page', async () => {
    await openPage('?id=1');
    $('assign-return').click();
    expect([...form().querySelectorAll('#m-action option')].map((o) => o.value)).toEqual(['assign', 'return']);
    form().querySelector('#m-quantity').value = '1';
    form().querySelector('#m-person').value = 'Kevin Otieno';
    form().requestSubmit();
    await waitFor(() => text('history-count').startsWith('3 movements'));
    expect(text('d-quantity')).toBe('6 total · 3 available');
    expect(text('d-assigned')).toBe('3 units assigned · latest: Kevin Otieno');
    expect([...$('item-badges').querySelectorAll('.badge')].map((b) => b.textContent)).toEqual(['3 assigned', '3 available']);
  });

  test('Record movement offers every action for the group', async () => {
    await openPage('?id=1');
    $('record-movement').click();
    expect([...form().querySelectorAll('#m-action option')].map((o) => o.value)).toEqual(['assign', 'return', 'receive']);
  });

  test('Edit saves with PUT and the page shows the new details', async () => {
    await openPage('?id=1');
    $('edit-item').click();
    form().querySelector('[name="name"]').value = 'Dell Latitude 5420 Plus';
    form().requestSubmit();
    await waitFor(() => text('item-title') === 'Dell Latitude 5420 Plus');
    expect(mock.calls.some((c) => c.method === 'PUT')).toBe(true);
  });

  test('Delete asks first, warns about assigned units, then removes the item and its history', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => {}); // jsdom cannot navigate
    await openPage('?id=1');
    $('delete-item').click();
    expect(dialog().textContent).toContain('2 units are currently assigned.');
    dialog().querySelector('[data-cancel]').click();
    expect(mock.calls.filter((c) => c.method === 'DELETE')).toHaveLength(0);
    $('delete-item').click();
    dialog().querySelector('[data-confirm]').click();
    await waitFor(() => !mock.db.items.some((i) => i.id === 1));
    expect(mock.db.movements.some((m) => m.itemId === 1)).toBe(false);
  });
});

describe('Item detail: a stocked item and error cases', () => {
  test('a consumable shows Restock / Issue, "in stock" and no assignment', async () => {
    await openPage('?id=7');
    expect(text('item-kind')).toBe('Consumable · Cable');
    expect($('assign-return').hidden).toBe(true);
    expect($('restock-issue').hidden).toBe(false);
    expect(text('d-quantity')).toBe('4 in stock');
    expect(text('d-assigned')).toBe('Not applicable');
    expect(text('history-note')).toBe('');
    expect([...$('item-badges').querySelectorAll('.badge')].map((b) => b.textContent)).toEqual(['Low stock']);
    $('restock-issue').click();
    expect([...form().querySelectorAll('#m-action option')].map((o) => o.value)).toEqual(['restock', 'issue']);
  });

  test('no id in the address shows a clear message', async () => {
    await openPage('');
    expect($('detail-state').textContent).toContain('No item selected.');
    expect($('detail-content').hidden).toBe(true);
  });

  test('an unknown id says the item no longer exists, without a Retry button', async () => {
    await openPage('?id=999');
    expect($('detail-state').textContent).toContain('This item no longer exists.');
    expect($('detail-state').querySelector('[data-retry]')).toBeNull();
  });

  test('a network error offers Retry, and Retry recovers', async () => {
    mock.offline = true;
    await openPage('?id=1');
    expect($('detail-state').textContent).toContain('Could not load the item.');
    mock.offline = false;
    $('detail-state').querySelector('[data-retry]').click();
    await waitFor(() => !$('detail-content').hidden);
  });

  test('an item with no history shows a friendly row', async () => {
    mock.db.movements = [];
    await openPage('?id=1');
    expect($('history-body').textContent).toContain('No movements recorded yet.');
    expect(text('history-count')).toBe('0 movements · Complete history');
    expect(text('d-assigned')).toBe('2 units assigned');
  });
});
