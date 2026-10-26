/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createMockApi, loadPage, sleep, waitFor } from './helpers/mockApi.js';

let mock;
const $ = (id) => document.getElementById(id);
const rows = () => [...document.querySelectorAll('#movements-body tr')];
const cells = (row) => [...row.querySelectorAll('td')].map((c) => c.textContent.trim());

async function openPage() {
  loadPage('movements.html');
  await import('../js/pages/movements.js?' + Math.random());
  await waitFor(() => rows().length > 0 || $('movements-state').textContent.includes('Could not') || $('movements-state').textContent.includes('No movements'));
}
async function setFilter(id, value, wait = 0) {
  const el = $(id);
  el.value = value;
  el.dispatchEvent(new Event('input', { bubbles: true }));
  await sleep(wait);
}

beforeEach(() => {
  jest.resetModules();
  mock = createMockApi();
  global.fetch = mock.fetch;
});

describe('Movements page', () => {
  test('lists the newest movements first, 8 per page, with signed quantities', async () => {
    await openPage();
    expect(rows()).toHaveLength(8);
    expect($('movements-count').textContent).toBe('Showing 1–8 of 16 movements');
    expect(cells(rows()[0]).slice(1)).toEqual(['HP 207A Toner', 'Restocked', '+8', 'PO-1109']);
    expect(cells(rows()[1]).slice(1)).toEqual(['HDMI Cable 2m', 'Issued', '−6', 'Meeting rooms']);
    expect(cells(rows()[7]).slice(1, 4)).toEqual(['Dell Latitude 5420', 'Assigned', '2']);
    expect(rows()[0].querySelector('a').getAttribute('href')).toBe('item-detail.html?id=8');
  });

  test('the pager moves between pages', async () => {
    await openPage();
    $('movements-pager').querySelector('[data-page="2"]').click();
    expect(rows()).toHaveLength(8);
    expect($('movements-count').textContent).toBe('Showing 9–16 of 16 movements');
    expect($('movements-pager').querySelector('[data-page="3"]').disabled).toBe(true);
  });

  test('filters by action, search text and date range', async () => {
    await openPage();
    await setFilter('filter-action', 'issue');
    expect(rows()).toHaveLength(3);
    await setFilter('filter-action', '');
    await setFilter('filter-search', 'maya', 260);
    expect(rows()).toHaveLength(1);
    await setFilter('filter-search', 'workstation', 260);
    expect(cells(rows()[0])[1]).toBe('Samsung 970 EVO 500GB SSD');
    await setFilter('filter-search', '', 260);
    await setFilter('filter-from', '2026-10-19');
    await setFilter('filter-to', '2026-10-20');
    expect(rows()).toHaveLength(3);
    expect($('movements-count').textContent).toBe('Showing 1–3 of 3 movements');
  });

  test('shows a message when nothing matches, and both Clear controls restore the list', async () => {
    await openPage();
    await setFilter('filter-search', 'no such movement', 260);
    expect($('movements-state').textContent).toContain('No movements found');
    expect($('movements-card').hidden).toBe(true);
    $('movements-state').querySelector('[data-empty-action]').click();
    expect(rows()).toHaveLength(8);
    await setFilter('filter-action', 'receive');
    expect(rows()).toHaveLength(8);
    document.querySelector('#filters [type="reset"]').click();
    await sleep(20);
    expect($('filter-action').value).toBe('');
    expect($('movements-count').textContent).toBe('Showing 1–8 of 16 movements');
  });

  test('Enter in the search box does not submit the form', async () => {
    await openPage();
    const event = new Event('submit', { bubbles: true, cancelable: true });
    $('filters').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  test('an empty history and a network error are handled', async () => {
    mock.db.movements = [];
    await openPage();
    expect($('movements-state').textContent).toContain('No movements yet');
    jest.resetModules();
    mock.offline = true;
    await openPage();
    expect($('movements-state').textContent).toContain('Could not load movements.');
    mock.offline = false;
    $('movements-state').querySelector('[data-retry]').click();
    await sleep(30);
  });
});
