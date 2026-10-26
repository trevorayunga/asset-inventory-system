import { describe, expect, test } from '@jest/globals';
import { actionsFor, applyMovement } from '../js/stock.js';
import { validateMovement } from '../js/validators.js';

const laptop = { id: 1, quantity: 6, assignedQuantity: 2, reorderLevel: 2, status: 'active', category: { group: 'asset' } };
const mouse = { id: 3, quantity: 20, assignedQuantity: 8, reorderLevel: 5, status: 'active', category: { group: 'accessory' } };
const ssd = { id: 6, quantity: 3, assignedQuantity: 0, reorderLevel: 5, status: 'active', category: { group: 'component' } };
const hdmi = { id: 7, quantity: 4, assignedQuantity: 0, reorderLevel: 10, status: 'active', category: { group: 'consumable' } };

describe('actionsFor', () => {
  test('assignable groups assign and return, stocked groups issue and restock', () => {
    expect(actionsFor('asset')).toEqual(['assign', 'return', 'receive']);
    expect(actionsFor('accessory')).toEqual(['assign', 'return', 'receive']);
    expect(actionsFor('component')).toEqual(['issue', 'restock', 'receive']);
    expect(actionsFor('consumable')).toEqual(['issue', 'restock', 'receive']);
    expect(actionsFor(undefined)).toEqual([]);
  });
});

describe('applyMovement', () => {
  test('returns only the fields to PATCH, without changing the item', () => {
    expect(applyMovement(laptop, 'assign', 2)).toEqual({ assignedQuantity: 4 });
    expect(applyMovement(laptop, 'return', '1')).toEqual({ assignedQuantity: 1 });
    expect(applyMovement(hdmi, 'issue', 3)).toEqual({ quantity: 1 });
    expect(applyMovement(hdmi, 'restock', 6)).toEqual({ quantity: 10 });
    expect(applyMovement(laptop, 'receive', 2)).toEqual({ quantity: 8 });
    expect(laptop.assignedQuantity).toBe(2);
  });
  test('throws for an unknown action', () => {
    expect(() => applyMovement(laptop, 'teleport', 1)).toThrow(/Unknown movement action/);
  });
});

describe('validateMovement', () => {
  test('accepts valid movements for each group', () => {
    expect(validateMovement(laptop, { action: 'assign', quantity: '4', person: 'Maya' }).valid).toBe(true);
    expect(validateMovement(mouse, { action: 'return', quantity: '8' }).valid).toBe(true);
    expect(validateMovement(ssd, { action: 'issue', quantity: '3' }).valid).toBe(true);
    expect(validateMovement(hdmi, { action: 'restock', quantity: '10' }).valid).toBe(true);
  });
  test('blocks over-assigning, over-returning and over-issuing', () => {
    expect(validateMovement(laptop, { action: 'assign', quantity: '5', person: 'x' }).errors.quantity).toBe('Only 4 available to assign.');
    expect(validateMovement(laptop, { action: 'return', quantity: '3' }).errors.quantity).toBe('Only 2 currently assigned.');
    expect(validateMovement(hdmi, { action: 'issue', quantity: '5' }).errors.quantity).toBe('Only 4 in stock.');
  });
  test('assigning needs a person; other actions do not', () => {
    expect(validateMovement(laptop, { action: 'assign', quantity: '1', person: '  ' }).errors.person).toBeDefined();
    expect(validateMovement(laptop, { action: 'return', quantity: '1' }).errors.person).toBeUndefined();
    expect(validateMovement(hdmi, { action: 'issue', quantity: '1' }).valid).toBe(true);
  });
  test('quantity must be a whole number of 1 or more', () => {
    ['0', '-2', '1.5', '', 'abc'].forEach((quantity) => {
      expect(validateMovement(hdmi, { action: 'restock', quantity }).errors.quantity).toBe('Enter a whole number of 1 or more.');
    });
  });
  test('actions must suit the item\'s group', () => {
    expect(validateMovement(hdmi, { action: 'assign', quantity: '1', person: 'x' }).errors.action).toBe('This action is not available for this item.');
    expect(validateMovement(laptop, { action: 'issue', quantity: '1' }).errors.action).toBeDefined();
  });
  test('items in maintenance or retired cannot be assigned or issued, but can be returned or restocked', () => {
    const inMaintenance = { ...laptop, status: 'maintenance' };
    expect(validateMovement(inMaintenance, { action: 'assign', quantity: '1', person: 'x' }).errors.action).toBe("Items that are in maintenance can't be assigned.");
    expect(validateMovement({ ...hdmi, status: 'retired' }, { action: 'issue', quantity: '1' }).errors.action).toBe("Items that are retired can't be issued.");
    expect(validateMovement(inMaintenance, { action: 'return', quantity: '1' }).valid).toBe(true);
    expect(validateMovement({ ...hdmi, status: 'retired' }, { action: 'restock', quantity: '1' }).valid).toBe(true);
  });
});
