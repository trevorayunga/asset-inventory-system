// Movement API calls: history (GET) and recording a stock or assignment change (PATCH + POST).
import { get, post } from './api.js';
import { patchItem } from './itemService.js';
import { applyMovement } from './stock.js';

/** Newest first, each with its item attached. Optionally only one item's history, or the latest few. */
export const getMovements = ({ itemId, limit } = {}) => get('/movements', {
  itemId,
  _limit: limit,
  _sort: 'date',
  _order: 'desc',
  _expand: 'item',
});

export const createMovement = (movement) => post('/movements', movement);

/**
 * Updates the item's numbers (PATCH), then adds a history entry (POST).
 * If the history entry fails, the item is put back as it was, so the two never disagree.
 */
export async function recordMovement(item, {
  action, quantity, person = '', note = '',
}) {
  const qty = Number(quantity);
  const changes = applyMovement(item, action, qty);
  const original = Object.fromEntries(Object.keys(changes).map((field) => [field, item[field]]));

  const updatedItem = await patchItem(item.id, changes);
  try {
    const movement = await createMovement({
      itemId: item.id,
      action,
      quantity: qty,
      person: person.trim(),
      note: note.trim(),
      date: new Date().toISOString(),
    });
    return { item: updatedItem, movement };
  } catch (error) {
    try { await patchItem(item.id, original); } catch { /* best effort: the original error matters more */ }
    throw error;
  }
}