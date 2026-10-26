import { beforeEach, describe, expect, test } from '@jest/globals';
import { getItem } from '../js/itemService.js';
import { recordMovement } from '../js/movementService.js';
import { createMockApi } from './helpers/mockApi.js';

let mock;
beforeEach(() => { mock = createMockApi(); global.fetch = mock.fetch; });

describe('recordMovement', () => {
  test('PATCHes the item then POSTs the movement', async () => {
    const item = await getItem(1);
    const { item: updated, movement } = await recordMovement(item, { action: 'assign', quantity: '2', person: ' Kevin ', note: ' PO ' });
    expect(updated.assignedQuantity).toBe(4);
    expect(movement).toMatchObject({ itemId: 1, action: 'assign', quantity: 2, person: 'Kevin', note: 'PO' });
    expect(mock.calls.slice(-2).map((c) => c.method)).toEqual(['PATCH', 'POST']);
    expect(mock.calls.at(-2).body).toEqual({ assignedQuantity: 4 });
  });

  test('puts the item back if the history entry cannot be saved', async () => {
    const item = await getItem(7);
    const real = mock.fetch;
    global.fetch = async (url, options = {}) => (options.method === 'POST' ? { ok: false, status: 500, text: async () => '' } : real(url, options));
    await expect(recordMovement(item, { action: 'issue', quantity: 3 })).rejects.toMatchObject({ status: 500 });
    expect(mock.db.items.find((i) => i.id === 7).quantity).toBe(4);
    expect(mock.calls.filter((c) => c.method === 'PATCH').map((c) => c.body)).toEqual([{ quantity: 1 }, { quantity: 4 }]);
  });

  test('does not touch the history if the PATCH fails', async () => {
    const item = await getItem(7);
    const real = mock.fetch;
    global.fetch = async (url, options = {}) => (options.method === 'PATCH' ? { ok: false, status: 500, text: async () => '' } : real(url, options));
    await expect(recordMovement(item, { action: 'issue', quantity: 1 })).rejects.toBeDefined();
    expect(mock.db.movements).toHaveLength(16);
  });
});
