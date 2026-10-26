import { describe, expect, test } from '@jest/globals';
import { filterItems, paginate, sortItems } from '../js/filters.js';
import { matchesStatus } from '../js/stock.js';

const mk = (id, name, sku, categoryId, group, quantity, assignedQuantity, unitCost, reorderLevel, status = 'active') => ({
  id, name, sku, categoryId, quantity, assignedQuantity, unitCost, reorderLevel, status, category: { id: categoryId, group },
});
const items = [
  mk(1, 'Dell Latitude 5420', 'LAP-001', 1, 'asset', 6, 2, 95000, 2),
  mk(2, 'Epson EB-X49', 'PRJ-001', 2, 'asset', 3, 1, 62000, 1),
  mk(3, 'Logitech M185 Wireless Mouse', 'MSE-001', 4, 'accessory', 20, 8, 1500, 5),
  mk(4, 'HP X1000 Wired Mouse', 'MSE-002', 4, 'accessory', 15, 3, 900, 5),
  mk(5, 'Kingston 8GB DDR4 RAM', 'RAM-001', 6, 'component', 12, 0, 4500, 4),
  mk(6, 'Samsung 970 EVO 500GB SSD', 'SSD-001', 7, 'component', 3, 0, 9500, 5),
  mk(7, 'HDMI Cable 2m', 'CBL-001', 8, 'consumable', 4, 0, 800, 10),
  mk(8, 'HP 207A Toner', 'TON-001', 9, 'consumable', 12, 0, 8500, 4),
];
const ids = (list) => list.map((i) => i.id);

describe('filterItems', () => {
  test('no filters returns everything', () => {
    expect(filterItems(items)).toHaveLength(8);
    expect(filterItems(items, {})).toHaveLength(8);
  });
  test('searches name and SKU, ignoring case and surrounding spaces', () => {
    expect(ids(filterItems(items, { search: 'MOUSE' }))).toEqual([3, 4]);
    expect(ids(filterItems(items, { search: '  ssd-001 ' }))).toEqual([6]);
    expect(ids(filterItems(items, { search: 'hp' }))).toEqual([4, 8]);
    expect(filterItems(items, { search: 'zzz' })).toEqual([]);
  });
  test('filters by category and by group', () => {
    expect(ids(filterItems(items, { categoryId: '4' }))).toEqual([3, 4]);
    expect(ids(filterItems(items, { group: 'consumable' }))).toEqual([7, 8]);
    expect(ids(filterItems(items, { group: 'component' }))).toEqual([5, 6]);
  });
  test('filters by status', () => {
    expect(ids(filterItems(items, { status: 'low' }))).toEqual([6, 7]);
    expect(ids(filterItems(items, { status: 'assigned' }))).toEqual([1, 2, 3, 4]);
    expect(ids(filterItems(items, { status: 'available' }))).toEqual([1, 2, 3, 4, 5, 8]);
  });
  test('combines every filter with AND', () => {
    expect(ids(filterItems(items, { group: 'accessory', status: 'assigned', search: 'wired' }))).toEqual([4]);
    expect(filterItems(items, { group: 'asset', status: 'low' })).toEqual([]);
  });
});

describe('matchesStatus', () => {
  test('maintenance, retired and fully assigned items', () => {
    expect(matchesStatus({ ...items[0], status: 'maintenance' }, 'maintenance')).toBe(true);
    expect(matchesStatus({ ...items[0], status: 'maintenance' }, 'available')).toBe(false);
    expect(matchesStatus({ ...items[0], status: 'retired' }, 'retired')).toBe(true);
    expect(matchesStatus({ ...items[0], assignedQuantity: 6 }, 'available')).toBe(false);
    expect(matchesStatus({ ...items[0], assignedQuantity: 6 }, 'assigned')).toBe(true);
    expect(matchesStatus(items[0], '')).toBe(true);
    expect(matchesStatus(items[0], 'unknown')).toBe(true);
  });
});

describe('sortItems', () => {
  test('sorts by name, quantity and cost without changing the original', () => {
    expect(ids(sortItems(items, 'name-asc'))).toEqual([1, 2, 7, 8, 4, 5, 3, 6]);
    expect(ids(sortItems(items, 'name-desc'))).toEqual([6, 3, 5, 4, 8, 7, 2, 1]);
    expect(sortItems(items, 'quantity-desc')[0].id).toBe(3);
    expect(sortItems(items, 'quantity-asc')[0].id).toBe(2);
    expect(ids(sortItems(items, 'cost-desc')).slice(0, 2)).toEqual([1, 2]);
    expect(ids(items)).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
  });
  test('an unknown key falls back to name A-Z', () => {
    expect(ids(sortItems(items, 'nonsense'))).toEqual(ids(sortItems(items, 'name-asc')));
  });
});

describe('paginate', () => {
  const list = Array.from({ length: 19 }, (_, i) => i + 1);
  test('slices a page and reports the range', () => {
    expect(paginate(list, 1, 8)).toMatchObject({ page: 1, totalPages: 3, total: 19, from: 1, to: 8 });
    expect(paginate(list, 3, 8)).toMatchObject({ items: [17, 18, 19], from: 17, to: 19 });
  });
  test('keeps the page in range and handles empty lists', () => {
    expect(paginate(list, 99, 8).page).toBe(3);
    expect(paginate(list, 0, 8).page).toBe(1);
    expect(paginate(list, 'abc', 8).page).toBe(1);
    expect(paginate([], 1, 8)).toMatchObject({ items: [], total: 0, from: 0, to: 0, totalPages: 1, page: 1 });
  });
  test('uses the configured page size by default', () => {
    expect(paginate(list).items).toHaveLength(8);
  });
});
