// Temporary check for Step 4. Run it while the API is running. Delete it afterwards.
import { ApiError, buildQuery, get, post, request } from './js/api.js';
import {
  createItem, deleteItem, getCategories, getItem, getItems, patchItem, toItemPayload, updateItem,
} from './js/itemService.js';

let failures = 0;
const check = (name, ok) => {
  if (!ok) failures += 1;
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}`);
};

// buildQuery (pure function)
check('buildQuery skips empty values', buildQuery({ a: 1, b: '', c: undefined }) === '?a=1');
check('buildQuery repeats array keys', buildQuery({ _expand: ['x', 'y'] }) === '?_expand=x&_expand=y');

// GET
const items = await getItems();
check('GET /items returns 8 items', items.length === 8);
check('items are sorted by name and expanded with category',
  items[0].name === 'Dell Latitude 5420' && items[0].category.group === 'asset');
check('GET /categories returns 9 categories', (await getCategories()).length === 9);
check('GET /items/1 returns the Dell', (await getItem(1)).sku === 'LAP-001');

// POST
const created = await createItem({
  name: 'Logitech K120 Keyboard', sku: 'KBD-001', categoryId: 5, quantity: 10,
  unitCost: 1800, reorderLevel: 3, status: 'active',
});
check('POST /items creates item 9 with assignedQuantity 0', created.id === 9 && created.assignedQuantity === 0);

// PUT (needs the full record)
await updateItem(created.id, { ...toItemPayload(created), unitCost: 2000 });
const afterPut = await getItem(created.id);
check('PUT replaces the record and keeps the other fields', afterPut.unitCost === 2000 && afterPut.name === 'Logitech K120 Keyboard');

// PATCH (only the fields sent)
await patchItem(created.id, { quantity: 12 });
const afterPatch = await getItem(created.id);
check('PATCH changes one field only', afterPatch.quantity === 12 && afterPatch.unitCost === 2000);

// toItemPayload strips the expanded category
check('toItemPayload drops expanded objects', !('category' in toItemPayload(afterPatch)));

// DELETE with dependent movements
await post('/movements', { itemId: created.id, action: 'receive', quantity: 12, person: '', note: 'test', date: '2026-10-21T10:00:00.000Z' });
await deleteItem(created.id);
check('DELETE removes the item and its movements',
  (await get('/movements', { itemId: created.id })).length === 0 && (await get('/items')).length === 8);

// Error handling
try { await getItem(999); check('404 is reported', false); } catch (e) {
  check('404 becomes an ApiError with status 404', e instanceof ApiError && e.status === 404 && /could not be found/.test(e.message));
}
try { await request('http://localhost:3999/nothing'); check('network error is reported', false); } catch (e) {
  check('unreachable server becomes a friendly ApiError', e instanceof ApiError && e.status === 0 && /Network error/.test(e.message));
}

console.log(failures === 0 ? '\nAll checks passed.' : `\n${failures} check(s) failed.`);
process.exit(failures === 0 ? 0 : 1);