/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { createMockApi, loadPage, polyfillDialog, waitFor } from './helpers/mockApi.js';

let mock;
const $ = (id) => document.getElementById(id);
const text = (id) => $(id).textContent.replace(/\u00a0/g, ' ');

async function openPage() {
  loadPage('index.html');
  await import('../js/pages/dashboard.js?' + Math.random());
  await waitFor(() => !$('dashboard-content').hidden || $('dashboard-state').textContent.includes('Could not'));
}

beforeEach(() => {
  jest.resetModules();
  polyfillDialog();
  mock = createMockApi();
  global.fetch = mock.fetch;
});

describe('Dashboard page', () => {
  test('shows a loading state, then the content', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const real = mock.fetch;
    global.fetch = async (...args) => { await gate; return real(...args); };
    loadPage('index.html');
    await import('../js/pages/dashboard.js?' + Math.random());
    expect($('dashboard-state').textContent).toContain('Loading dashboard…');
    expect($('dashboard-content').hidden).toBe(true);
    release();
    await waitFor(() => !$('dashboard-content').hidden);
    expect($('dashboard-state').hidden).toBe(true);
  });

  test('shows the key figures worked out from the data', async () => {
    await openPage();
    expect(text('stat-items')).toBe('75');
    expect(text('stat-items-note')).toBe('Units across 8 item records');
    expect(text('stat-value')).toBe('KES 987,200');
    expect(text('stat-low')).toBe('2');
    expect($('stat-low-card').classList.contains('is-alert')).toBe(true);
    expect(text('stat-assigned')).toBe('14');
    expect(text('stat-assigned-note')).toBe('Of 44 assets and accessories');
    expect(text('band-assignable')).toBe('44 units · KES 799,500');
    expect(text('band-available')).toBe('30 units');
    expect(text('band-stocked')).toBe('31 units · KES 187,700');
    expect(text('band-next')).toBe('Review 2 low-stock items');
  });

  test('lists the low-stock items and the five latest movements, newest first', async () => {
    await openPage();
    const alerts = [...document.querySelectorAll('#low-stock-list .alert-item')];
    expect(alerts.map((a) => a.querySelector('h3').textContent).sort()).toEqual(['HDMI Cable 2m', 'Samsung 970 EVO 500GB SSD']);
    const rows = [...document.querySelectorAll('#recent-body tr')].map((r) => [...r.querySelectorAll('td')].map((c) => c.textContent.trim()));
    expect(rows).toHaveLength(5);
    expect(rows[0].slice(1)).toEqual(['HP 207A Toner', 'Restocked', '+8', 'PO-1109']);
    expect(rows[1].slice(1, 4)).toEqual(['HDMI Cable 2m', 'Issued', '−6']);
    expect(rows[0][0]).toBe('20 Oct');
    expect($('today').textContent).toMatch(/\d{4}/);
  });

  test('restocking from an alert updates every figure', async () => {
    await openPage();
    const button = [...document.querySelectorAll('[data-action="restock"]')].find((b) => b.closest('.alert-item').textContent.includes('Samsung'));
    button.click();
    const form = document.querySelector('dialog form');
    expect(form.querySelector('#m-action').value).toBe('restock');
    form.querySelector('#m-quantity').value = '10';
    form.requestSubmit();
    await waitFor(() => text('stat-low') === '1');
    expect(text('band-next')).toBe('Review 1 low-stock item');
    expect(text('stat-value')).toBe('KES 1,082,200');
    expect(document.querySelectorAll('#low-stock-list .alert-item')).toHaveLength(1);
    expect(document.querySelector('#recent-body tr td:nth-child(3)').textContent).toBe('Restocked');
  });

  test('shows an all-clear message and no alert styling when nothing is low', async () => {
    mock.db.items.forEach((i) => { i.quantity += 50; });
    await openPage();
    expect(text('stat-low')).toBe('0');
    expect($('stat-low-card').classList.contains('is-alert')).toBe(false);
    expect($('low-stock-list').textContent).toContain('All components and consumables are above their reorder levels.');
    expect(text('band-next')).toBe('No action needed');
  });

  test('shows an error with Retry, and Retry recovers', async () => {
    mock.offline = true;
    await openPage();
    expect($('dashboard-state').textContent).toContain('Could not load the dashboard.');
    expect($('dashboard-content').hidden).toBe(true);
    mock.offline = false;
    $('dashboard-state').querySelector('[data-retry]').click();
    await waitFor(() => !$('dashboard-content').hidden);
  });

  test('copes with an empty inventory', async () => {
    mock.db.items = [];
    mock.db.movements = [];
    await openPage();
    expect(text('stat-items')).toBe('0');
    expect(text('stat-value')).toBe('KES 0');
    expect($('recent-body').textContent).toContain('No movements recorded yet.');
  });
});
