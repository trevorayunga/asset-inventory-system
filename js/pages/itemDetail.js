// Item detail: summary, actions and the item's full movement history.
import { confirmDialog } from '../dialogs.js';
import { openItemDialog } from '../itemForm.js';
import {
  deleteItem, getCategories, getItem, getItems,
} from '../itemService.js';
import { openMovementDialog } from '../movementDialog.js';
import { getMovements } from '../movementService.js';
import {
  GROUP_LABELS, actionsFor, assignedUnits, availableUnits, describeAssignment, describeStock, displayStatus,
  isAssignableGroup, isStockedGroup, itemGroup,
} from '../stock.js';
import {
  badge, clearState, formatCurrency, initPage, renderMovementRow, showError, showLoading, toast,
} from '../ui.js';

const $ = (id) => document.getElementById(id);
const itemId = new URLSearchParams(window.location.search).get('id');
const ctx = {
  item: null, movements: [], categories: [], items: [],
};

function render() {
  const { item, movements } = ctx;
  const group = itemGroup(item);
  const status = displayStatus(item);

  document.title = `${item.name} | AssetTrack`;
  $('crumb-name').textContent = item.name;
  $('item-title').textContent = item.name;
  $('item-kind').textContent = `${GROUP_LABELS[group] ?? 'No group'} · ${item.category?.name ?? '—'}`;
  $('item-badges').innerHTML = isAssignableGroup(group) && assignedUnits(item) > 0
    ? `${badge(status.label, status.variant)} ${badge(`${availableUnits(item)} available`, 'success')}`
    : badge(status.label, status.variant);

  $('d-sku').textContent = item.sku;
  $('d-quantity').textContent = describeStock(item);
  $('d-cost').textContent = formatCurrency(item.unitCost);
  $('d-assigned').textContent = describeAssignment(item, movements);
  $('d-value').textContent = `Total value ${formatCurrency(item.unitCost * item.quantity)}`;

  // Each kind of item gets the one action pair that makes sense for it.
  $('assign-return').hidden = !isAssignableGroup(group);
  $('restock-issue').hidden = !isStockedGroup(group);
  $('record-movement').hidden = actionsFor(group).length === 0;

  $('history-body').innerHTML = movements.length
    ? movements.map((movement) => renderMovementRow(movement, { showItem: false })).join('')
    : '<tr><td colspan="4" class="muted">No movements recorded yet.</td></tr>';
  $('history-count').textContent = `${movements.length} movement${movements.length === 1 ? '' : 's'} · Complete history`;
  $('history-note').textContent = isAssignableGroup(group) ? 'Assignments change availability, not total quantity.' : '';
}

async function load() {
  const state = $('detail-state');
  $('detail-content').hidden = true;
  if (!itemId) {
    showError(state, 'No item selected. Go back to the Items page and choose an item.');
    return;
  }
  showLoading(state, 'Loading item…');
  try {
    [ctx.item, ctx.movements, ctx.categories, ctx.items] = await Promise.all([
      getItem(itemId), getMovements({ itemId }), getCategories(), getItems(),
    ]);
    render();
    clearState(state);
    $('detail-content').hidden = false;
  } catch (error) {
    const gone = error.status === 404;
    showError(state, gone ? 'This item no longer exists.' : `Could not load the item. ${error.message}`, gone ? null : load);
  }
}

const openMovement = (actions, defaultAction) => openMovementDialog({
  item: ctx.item, actions, defaultAction, onSaved: load,
});

$('record-movement').addEventListener('click', () => {
  const group = itemGroup(ctx.item);
  openMovement(actionsFor(group), isStockedGroup(group) ? 'restock' : 'assign');
});
$('assign-return').addEventListener('click', () => openMovement(['assign', 'return'], 'assign'));
$('restock-issue').addEventListener('click', () => openMovement(['restock', 'issue'], 'restock'));
$('edit-item').addEventListener('click', () => openItemDialog({
  mode: 'edit', item: ctx.item, categories: ctx.categories, existingItems: ctx.items, onSaved: load,
}));
$('delete-item').addEventListener('click', async () => {
  const assigned = assignedUnits(ctx.item);
  const warning = assigned > 0 ? ` ${assigned} units are currently assigned.` : '';
  const confirmed = await confirmDialog({
    title: 'Delete item',
    message: `Delete "${ctx.item.name}" and its movement history?${warning} This cannot be undone.`,
    confirmLabel: 'Delete item',
  });
  if (!confirmed) return;
  try {
    await deleteItem(ctx.item.id);
    window.location.href = 'items.html';
  } catch (error) {
    toast(`Could not delete the item. ${error.message}`, 'error');
  }
});

initPage();
load();