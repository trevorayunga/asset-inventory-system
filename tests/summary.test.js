/** @jest-environment jsdom */
import { describe, expect, test } from '@jest/globals';
import { filterMovements } from '../js/filters.js';
import { getMovements } from '../js/movementService.js';
import {
  describeAssignment, describeStock, getSummary, totalValue,
} from '../js/stock.js';
import {
  formatCurrency, formatDate, formatQuantity, initPage, renderLowStockAlert, renderMovementRow,
} from '../js/ui.js';
import { createMockApi } from './helpers/mockApi.js';

const mk = (id, group, quantity, assignedQuantity, unitCost, reorderLevel, status = 'active') => ({
  id, name: `Item ${id}`, sku: `S-${id}`, quantity, assignedQuantity, unitCost, reorderLevel, status, category: { name: 'Cat', group },
});
const items = [
  mk(1, 'asset', 6, 2, 95000, 2),
  mk(2, 'accessory', 20, 8, 1500, 5),
  mk(3, 'component', 3, 0, 9500, 5),
  mk(4, 'consumable', 12, 0, 8500, 4),
];
const plain = (text) => text.replace(/\u00a0/g, ' ');

describe('getSummary', () => {
  test('adds up units, value, low stock and assignment', () => {
    const s = getSummary(items);
    expect(s).toMatchObject({
      itemRecords: 4, totalUnits: 41, totalValue: 570000 + 30000 + 28500 + 102000,
      assignableUnits: 26, assignableValue: 600000, assignedUnits: 10, availableToAssign: 16,
      stockedUnits: 15, stockedValue: 130500,
    });
    expect(s.lowStock.map((i) => i.id)).toEqual([3]);
  });
  test('handles an empty list', () => {
    expect(getSummary([])).toMatchObject({ itemRecords: 0, totalUnits: 0, totalValue: 0, lowStock: [] });
    expect(totalValue([])).toBe(0);
  });
});

describe('describeStock and describeAssignment', () => {
  test('wording for assignable and stocked items', () => {
    expect(describeStock(items[0])).toBe('6 total · 4 available');
    expect(describeStock(items[2])).toBe('3 in stock');
  });
  test('who holds an item', () => {
    const history = [{ action: 'return', person: '' }, { action: 'assign', person: 'Maya Patel' }];
    expect(describeAssignment(items[0], history)).toBe('2 units assigned · latest: Maya Patel');
    expect(describeAssignment(items[0], [])).toBe('2 units assigned');
    expect(describeAssignment({ ...items[0], assignedQuantity: 1 }, [])).toBe('1 unit assigned');
    expect(describeAssignment({ ...items[0], assignedQuantity: 0 }, [])).toBe('Not assigned');
    expect(describeAssignment(items[2], [])).toBe('Not applicable');
  });
});

describe('formatters and renderers', () => {
  test('currency uses the KES code with thousands separators', () => {
    expect(plain(formatCurrency(987200))).toBe('KES 987,200');
    expect(plain(formatCurrency(95000))).toBe('KES 95,000');
    expect(plain(formatCurrency('abc'))).toBe('KES 0');
  });
  test('dates and signed quantities', () => {
    expect(formatDate('2026-10-20T09:42:00.000Z', { short: true })).toMatch(/^20 Oct$/);
    expect(formatDate('2026-10-20T09:42:00.000Z')).toMatch(/20 Oct 2026/);
    expect(formatDate('nonsense')).toBe('—');
    expect(formatQuantity('issue', 6)).toBe('−6');
    expect(formatQuantity('restock', 8)).toBe('+8');
    expect(formatQuantity('receive', 2)).toBe('+2');
    expect(formatQuantity('assign', 3)).toBe('3');
  });
  test('movement rows escape text and link to the item', () => {
    const m = { itemId: 7, item: { name: '<b>HDMI</b>' }, action: 'issue', quantity: 6, person: 'Meeting rooms', note: '', date: '2026-10-19T12:00:00.000Z' };
    const html = renderMovementRow(m);
    expect(html).toContain('item-detail.html?id=7');
    expect(html).toContain('&lt;b&gt;HDMI&lt;/b&gt;');
    expect(html).toContain('Issued');
    expect(html).toContain('−6');
    expect(html).toContain('Meeting rooms');
    expect(renderMovementRow(m, { showItem: false })).not.toContain('item-detail.html');
    expect(renderMovementRow({ ...m, item: undefined, person: '' })).toContain('—');
  });
  test('low-stock alert card', () => {
    const html = renderLowStockAlert(items[2]);
    expect(html).toContain('Low stock · 3 left');
    expect(html).toContain('Reorder level: 5 units');
    expect(html).toContain('S-3 · Component');
    expect(html).toContain('data-action="restock" data-id="3"');
  });
  test('initPage writes the date into the footer', () => {
    document.body.innerHTML = '<time id="today"></time>';
    initPage();
    expect(document.getElementById('today').textContent).toMatch(/\d{4}/);
    document.body.innerHTML = '';
    expect(() => initPage()).not.toThrow();
  });
});

describe('filterMovements', () => {
  const movements = [
    { id: 1, action: 'assign', person: 'Maya Patel', note: '', date: '2026-10-20T09:42:00.000Z', item: { name: 'Dell Latitude' } },
    { id: 2, action: 'issue', person: '', note: 'Meeting rooms', date: '2026-10-19T12:00:00.000Z', item: { name: 'HDMI Cable' } },
    { id: 3, action: 'receive', person: '', note: 'PO-1030', date: '2026-10-12T10:15:00.000Z', item: { name: 'Dell Latitude' } },
  ];
  test('filters by action, text and an inclusive date range', () => {
    const ids = (f) => filterMovements(movements, f).map((m) => m.id);
    expect(ids({})).toEqual([1, 2, 3]);
    expect(ids({ action: 'issue' })).toEqual([2]);
    expect(ids({ search: 'MAYA' })).toEqual([1]);
    expect(ids({ search: 'dell' })).toEqual([1, 3]);
    expect(ids({ search: 'po-10' })).toEqual([3]);
    expect(ids({ from: '2026-10-19' })).toEqual([1, 2]);
    expect(ids({ to: '2026-10-12' })).toEqual([3]);
    expect(ids({ from: '2026-10-19', to: '2026-10-19' })).toEqual([2]);
    expect(ids({ action: 'assign', search: 'zzz' })).toEqual([]);
  });
});

describe('getMovements', () => {
  test('asks for newest first with the item attached, and can limit or filter by item', async () => {
    const mock = createMockApi();
    global.fetch = mock.fetch;
    const latest = await getMovements({ limit: 5 });
    expect(latest.map((m) => m.id)).toEqual([16, 14, 12, 10, 8]);
    expect(latest[0].item.name).toBe('HP 207A Toner');
    expect(mock.calls[0].url).toContain('_limit=5&_sort=date&_order=desc&_expand=item');
    const one = await getMovements({ itemId: 1 });
    expect(one.map((m) => m.id)).toEqual([2, 1]);
  });
});
