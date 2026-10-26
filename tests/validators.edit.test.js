import { describe, expect, test } from '@jest/globals';
import { validateItem } from '../js/validators.js';

const categories = [
  { id: 1, name: 'Laptop', group: 'asset' },
  { id: 4, name: 'Mouse', group: 'accessory' },
  { id: 8, name: 'Cable', group: 'consumable' },
];
const items = [{ id: 1, sku: 'LAP-001' }, { id: 2, sku: 'PRJ-001' }];
const valid = { name: 'Dell Latitude 5420', sku: 'LAP-001', categoryId: '1', quantity: '6', unitCost: '95000', reorderLevel: '2', status: 'active' };

describe('validateItem in edit mode', () => {
  test('allows the item to keep its own SKU but not another item\'s SKU', () => {
    expect(validateItem(valid, { existingItems: items, editingId: 1, categories }).valid).toBe(true);
    expect(validateItem({ ...valid, sku: 'prj-001' }, { existingItems: items, editingId: 1, categories }).errors.sku)
      .toBe('This SKU is already in use.');
  });

  test('quantity cannot drop below the assigned units', () => {
    const result = validateItem({ ...valid, quantity: '1' }, { existingItems: items, editingId: 1, assignedQuantity: 2, categories });
    expect(result.errors.quantity).toBe('Quantity cannot be below the 2 units already assigned.');
    expect(validateItem({ ...valid, quantity: '2' }, { existingItems: items, editingId: 1, assignedQuantity: 2, categories }).valid).toBe(true);
  });

  test('assigned items may change between assignable categories, not to a stocked one', () => {
    const opts = { existingItems: items, editingId: 1, assignedQuantity: 2, categories };
    expect(validateItem({ ...valid, categoryId: '4' }, opts).valid).toBe(true);
    expect(validateItem({ ...valid, categoryId: '8' }, opts).errors.categoryId).toMatch(/must stay an asset or accessory/);
  });

  test('items with nothing assigned may move to any category', () => {
    expect(validateItem({ ...valid, categoryId: '8' }, { existingItems: items, editingId: 1, assignedQuantity: 0, categories }).valid).toBe(true);
  });
});
