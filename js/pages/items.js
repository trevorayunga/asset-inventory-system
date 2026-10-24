// Items page: load items (Step 5) and add new ones (Step 6).
import { openItemDialog } from '../itemForm.js';
import { getCategories, getItems } from '../itemService.js';
import {
  clearState, renderItemRow, showEmpty, showError, showLoading, toast,
} from '../ui.js';

const $ = (id) => document.getElementById(id);
const state = { items: [], categories: [] };

function render(items) {
  const card = $('items-table-card');

  if (items.length === 0) {
    card.hidden = true;
    showEmpty($('items-state'), 'No items found', 'Click "+ Add Item" to create the first one.');
    return;
  }

  clearState($('items-state'));
  $('items-body').innerHTML = items.map(renderItemRow).join('');
  const units = items.reduce((sum, item) => sum + item.quantity, 0);
  $('items-count').textContent = `${items.length} items · ${units} units`;
  card.hidden = false;
}

async function loadItems() {
  $('items-table-card').hidden = true;
  showLoading($('items-state'), 'Loading items…');
  try {
    [state.items, state.categories] = await Promise.all([getItems(), getCategories()]);
    render(state.items);
  } catch (error) {
    showError($('items-state'), `Could not load items. ${error.message}`, loadItems);
  }
}

/** Reloads just the item list after a change, without the full-page loading state. */
async function refreshItems() {
  try {
    state.items = await getItems();
    render(state.items);
  } catch (error) {
    toast(`Could not refresh the list. ${error.message}`, 'error');
  }
}

function openAdd() {
  if (state.categories.length === 0) {
    toast('Categories have not loaded yet. Reload the page and try again.', 'error');
    return;
  }
  openItemDialog({ categories: state.categories, existingItems: state.items, onSaved: refreshItems });
}

$('add-item').addEventListener('click', openAdd);

loadItems().then(() => {
  // The dashboard's "+ Add Item" link points here with ?add=1.
  if (new URLSearchParams(window.location.search).get('add') === '1') openAdd();
});