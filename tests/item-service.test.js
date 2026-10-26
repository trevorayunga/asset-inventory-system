import { beforeEach, describe, expect, test } from '@jest/globals';
import {
  createItem, deleteItem, getCategories, getItem, getItems, patchItem, toItemPayload, updateItem,
} from '../js/itemService.js';
import { createMockApi } from './helpers/mockApi.js';

let mock;
beforeEach(() => {
  mock = createMockApi();
  global.fetch = mock.fetch;
});

const NEW_ITEM = {
  name: 'Logitech K120 Keyboard', sku: 'KBD-001', categoryId: 5, quantity: 10, unitCost: 1800, reorderLevel: 3, status: 'active',
};

describe('reading items', () => {
  test('getItems asks for the category to be attached and sorts by name', async () => {
    const items = await getItems();
    expect(items).toHaveLength(8);
    expect(items[0]).toMatchObject({ name: 'Dell Latitude 5420', category: { name: 'Laptop', group: 'asset' } });
    expect(mock.calls[0].url).toBe('http://localhost:3000/items?_expand=category&_sort=name');
  });
  test('getItem, getCategories', async () => {
    expect((await getItem(1)).sku).toBe('LAP-001');
    expect((await getItem(1)).category.name).toBe('Laptop');
    expect(await getCategories()).toHaveLength(9);
  });
  test('an unknown item is a 404', async () => {
    await expect(getItem(999)).rejects.toMatchObject({ status: 404 });
  });
});

describe('writing items', () => {
  test('toItemPayload keeps stored fields only (no expanded category)', () => {
    const payload = toItemPayload({ id: 1, name: 'A', sku: 'S', category: { name: 'x' }, quantity: 1, extra: true });
    expect(payload).toEqual({ name: 'A', sku: 'S', quantity: 1 });
  });
  test('createItem (POST) starts with nothing assigned', async () => {
    const created = await createItem(NEW_ITEM);
    expect(created).toMatchObject({ id: 9, assignedQuantity: 0, name: 'Logitech K120 Keyboard' });
    expect(mock.calls[0].method).toBe('POST');
  });
  test('updateItem (PUT) replaces the record', async () => {
    const created = await createItem(NEW_ITEM);
    await updateItem(created.id, { ...toItemPayload(created), unitCost: 2000 });
    expect(mock.db.items.at(-1)).toMatchObject({ unitCost: 2000, name: 'Logitech K120 Keyboard' });
    expect(mock.calls.at(-1).method).toBe('PUT');
  });
  test('patchItem (PATCH) changes only the fields sent', async () => {
    await patchItem(1, { quantity: 9 });
    expect(mock.db.items[0]).toMatchObject({ quantity: 9, name: 'Dell Latitude 5420', assignedQuantity: 2 });
  });
  test('deleteItem (DELETE) also removes the item\'s movements', async () => {
    expect(mock.db.movements.filter((m) => m.itemId === 1)).toHaveLength(2);
    await deleteItem(1);
    expect(mock.db.items.find((i) => i.id === 1)).toBeUndefined();
    expect(mock.db.movements.filter((m) => m.itemId === 1)).toHaveLength(0);
    expect(mock.calls.at(-1).url).toContain('_dependent=movements');
  });
});
