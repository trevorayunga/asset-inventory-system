// Movement API calls: record a stock or assignment change (PATCH the item, POST the movement).
import { post } from './api.js';
import { patchItem } from './itemService.js';
import { applyMovement } from './stock.js';

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