import { describe, expect, test } from '@jest/globals';
import { validateItem } from '../js/validators.js';

const valid = { name: 'Dell Monitor', sku: 'MON-002', categoryId: '3', quantity: '4', unitCost: '18000', reorderLevel: '1', status: 'active' };
const existing = [{ id: 1, sku: 'LAP-001' }];

describe('validateItem', () => {
  test('accepts a complete item', () => {
    expect(validateItem(valid, { existingItems: existing })).toEqual({ valid: true, errors: {} });
  });
  test('name rules', () => {
    expect(validateItem({ ...valid, name: '  ' }).errors.name).toBe('Name is required.');
    expect(validateItem({ ...valid, name: 'A' }).errors.name).toMatch(/2 to 80/);
  });
  test('sku rules: required, format, unique (case-insensitive)', () => {
    expect(validateItem({ ...valid, sku: '' }).errors.sku).toBe('SKU is required.');
    expect(validateItem({ ...valid, sku: 'bad sku!' }).errors.sku).toMatch(/letters, numbers/);
    expect(validateItem({ ...valid, sku: 'lap-001' }, { existingItems: existing }).errors.sku).toBe('This SKU is already in use.');
  });
  test('category required, no location field exists', () => {
    expect(validateItem({ ...valid, categoryId: '' }).errors.categoryId).toBe('Choose a category.');
    expect(validateItem(valid).errors.locationId).toBeUndefined();
  });
  test('quantity and reorder level must be whole numbers of 0 or more', () => {
    ['-1', '2.5', '', 'abc'].forEach((v) => {
      expect(validateItem({ ...valid, quantity: v }).errors.quantity).toBeDefined();
      expect(validateItem({ ...valid, reorderLevel: v }).errors.reorderLevel).toBeDefined();
    });
    expect(validateItem({ ...valid, quantity: '0' }).valid).toBe(true);
  });
  test('unit cost must be 0 or more', () => {
    expect(validateItem({ ...valid, unitCost: '-5' }).errors.unitCost).toBeDefined();
    expect(validateItem({ ...valid, unitCost: '' }).errors.unitCost).toBeDefined();
    expect(validateItem({ ...valid, unitCost: '799.5' }).valid).toBe(true);
  });
  test('status must be one of the allowed values', () => {
    expect(validateItem({ ...valid, status: 'assigned' }).errors.status).toBeDefined();
  });
});
