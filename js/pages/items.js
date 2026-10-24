// Items page: load items (Step 5), add (Step 6), edit and delete (Step 7).
import { confirmDialog } from '../dialogs.js';
import { openItemDialog } from '../itemForm.js';
import {
  deleteItem, getCategories, getItems,
} from '../itemService.js';
import { assignedUnits } from '../stock.js';
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

function openEdit(item) {
  openItemDialog({
    mode: 'edit', item, categories: state.categories, existingItems: state.items, onSaved: refreshItems,
  });
}

async function confirmAndDelete(item) {
  const assigned = assignedUnits(item);
  const warning = assigned > 0 ? ` ${assigned} units are currently assigned.` : '';
  const confirmed = await confirmDialog({
    title: 'Delete item',
    message: `Delete "${item.name}" and its movement history?${warning} This cannot be undone.`,
    confirmLabel: 'Delete item',
  });
  if (!confirmed) return;

  try {
    await deleteItem(item.id);
    toast('Item deleted.');
    await refreshItems();
  } catch (error) {
    toast(`Could not delete the item. ${error.message}`, 'error');
  }
}

$('add-item').addEventListener('click', openAdd);

// One listener for every row (event delegation): the rows are redrawn after each change.
$('items-body').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const item = state.items.find((entry) => String(entry.id) === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === 'edit') openEdit(item);
  else if (button.dataset.action === 'delete') confirmAndDelete(item);
  // The "movement" button (Assign / Restock) is wired in Step 8.
});

loadItems().then(() => {
  // The dashboard's "+ Add Item" link points here with ?add=1.
  if (new URLSearchParams(window.location.search).get('add') === '1') openAdd();
});