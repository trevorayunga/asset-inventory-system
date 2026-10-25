// Dashboard: key figures, low-stock alerts and the latest movements.
import { getItems } from '../itemService.js';
import { openMovementDialog } from '../movementDialog.js';
import { getMovements } from '../movementService.js';
import { getSummary } from '../stock.js';
import {
  clearState, formatCurrency, formatDate, initPage, renderLowStockAlert, renderMovementRow, showError, showLoading,
} from '../ui.js';

const $ = (id) => document.getElementById(id);
let items = [];

function render(allItems, movements) {
  const summary = getSummary(allItems);

  $('stat-items').textContent = summary.totalUnits;
  $('stat-items-note').textContent = `Units across ${summary.itemRecords} item records`;
  $('stat-value').textContent = formatCurrency(summary.totalValue);
  $('stat-low').textContent = summary.lowStock.length;
  $('stat-low-card').classList.toggle('is-alert', summary.lowStock.length > 0);
  $('stat-assigned').textContent = summary.assignedUnits;
  $('stat-assigned-note').textContent = `Of ${summary.assignableUnits} assets and accessories`;

  $('band-assignable').textContent = `${summary.assignableUnits} units · ${formatCurrency(summary.assignableValue)}`;
  $('band-available').textContent = `${summary.availableToAssign} units`;
  $('band-stocked').textContent = `${summary.stockedUnits} units · ${formatCurrency(summary.stockedValue)}`;
  const low = summary.lowStock.length;
  $('band-next').textContent = low ? `Review ${low} low-stock item${low === 1 ? '' : 's'}` : 'No action needed';

  $('low-stock-list').innerHTML = low
    ? summary.lowStock.map(renderLowStockAlert).join('')
    : '<p class="muted">All components and consumables are above their reorder levels.</p>';

  $('recent-body').innerHTML = movements.length
    ? movements.map((movement) => renderMovementRow(movement, { shortDate: true })).join('')
    : '<tr><td colspan="5" class="muted">No movements recorded yet.</td></tr>';

  $('updated-at').textContent = `Updated ${formatDate(new Date().toISOString())}`;
}

async function load() {
  const state = $('dashboard-state');
  $('dashboard-content').hidden = true;
  showLoading(state, 'Loading dashboard…');
  try {
    const [loadedItems, movements] = await Promise.all([getItems(), getMovements({ limit: 5 })]);
    items = loadedItems;
    render(items, movements);
    clearState(state);
    $('dashboard-content').hidden = false;
  } catch (error) {
    showError(state, `Could not load the dashboard. ${error.message}`, load);
  }
}

// "Restock item" buttons inside the alerts (they are redrawn, so listen on the container).
$('low-stock-list').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="restock"]');
  if (!button) return;
  const item = items.find((entry) => String(entry.id) === button.dataset.id);
  if (item) openMovementDialog({ item, actions: ['restock', 'issue', 'receive'], defaultAction: 'restock', onSaved: load });
});

initPage();
load();