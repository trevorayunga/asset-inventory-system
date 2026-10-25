// Items page: load (Step 5), add (6), edit and delete (7), stock movements (8), filters and pages (9).
import { confirmDialog } from '../dialogs.js';
import { filterItems, paginate, sortItems } from '../filters.js';
import { openItemDialog } from '../itemForm.js';
import {
  deleteItem, getCategories, getItems,
} from '../itemService.js';
import { openMovementDialog } from '../movementDialog.js';
import {
  actionsFor, assignedUnits, isStockedGroup, itemGroup,
} from '../stock.js';
import {
  clearState, debounce, fillSelect, renderItemRow, renderPager, showEmpty, showError, showLoading, toast,
} from '../ui.js';

const $ = (id) => document.getElementById(id);
const state = { items: [], categories: [], page: 1 };

function currentFilters() {
  return {
    search: $('filter-search').value,
    categoryId: $('filter-category').value,
    group: $('filter-group').value,
    status: $('filter-status').value,
  };
}

function clearFilters() {
  $('filters').reset();
  state.page = 1;
  render();
}

/** Applies the filters, the sort order and the current page, then draws the table. */
function render() {
  const card = $('items-table-card');

  if (state.items.length === 0) {
    card.hidden = true;
    showEmpty($('items-state'), 'No items found', 'Click "+ Add Item" to create the first one.');
    return;
  }

  const matches = sortItems(filterItems(state.items, currentFilters()), $('filter-sort').value);
  if (matches.length === 0) {
    card.hidden = true;
    showEmpty($('items-state'), 'No items found', 'Try another search or clear your filters.', 'Clear filters', clearFilters);
    return;
  }

  const pageInfo = paginate(matches, state.page);
  state.page = pageInfo.page; // paginate() keeps the page inside the valid range
  clearState($('items-state'));
  $('items-body').innerHTML = pageInfo.items.map(renderItemRow).join('');
  const units = matches.reduce((sum, item) => sum + item.quantity, 0);
  $('items-count').textContent = `Showing ${pageInfo.from}–${pageInfo.to} of ${pageInfo.total} items · ${units} units`;
  renderPager($('items-pager'), pageInfo, (page) => {
    state.page = page;
    render();
  });
  card.hidden = false;
}

async function loadItems() {
  $('items-table-card').hidden = true;
  showLoading($('items-state'), 'Loading items…');
  try {
    [state.items, state.categories] = await Promise.all([getItems(), getCategories()]);
    const chosen = $('filter-category').value;
    fillSelect($('filter-category'), state.categories, 'All categories');
    $('filter-category').value = chosen; // keep the user's choice if they pressed Retry
    render();
  } catch (error) {
    showError($('items-state'), `Could not load items. ${error.message}`, loadItems);
  }
}

/** Reloads just the item list after a change, without the full-page loading state. */
async function refreshItems() {
  try {
    state.items = await getItems();
    render();
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

function openMovement(item) {
  const group = itemGroup(item);
  const actions = actionsFor(group);
  if (actions.length === 0) {
    toast('This item\'s category has no group, so movements are unavailable.', 'error');
    return;
  }
  openMovementDialog({
    item, actions, defaultAction: isStockedGroup(group) ? 'restock' : 'assign', onSaved: refreshItems,
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

// Filters: selects apply at once, the search box waits until the user pauses typing.
function applyFilters() {
  state.page = 1;
  render();
}
const applyFiltersSoon = debounce(applyFilters, 200);
$('filters').addEventListener('input', (event) => {
  if (event.target.id === 'filter-search') applyFiltersSoon();
  else applyFilters();
});
$('filters').addEventListener('submit', (event) => event.preventDefault()); // Enter must not reload the page

// One listener for every row (event delegation): the rows are redrawn after each change.
$('items-body').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action]');
  if (!button) return;
  const item = state.items.find((entry) => String(entry.id) === button.dataset.id);
  if (!item) return;

  if (button.dataset.action === 'edit') openEdit(item);
  else if (button.dataset.action === 'movement') openMovement(item);
  else if (button.dataset.action === 'delete') confirmAndDelete(item);
});

loadItems().then(() => {
  // The dashboard's "+ Add Item" link points here with ?add=1.
  if (new URLSearchParams(window.location.search).get('add') === '1') openAdd();
});