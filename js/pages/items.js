// Items page (Step 5): load items from the API and show loading, error and empty states.
import { getItems } from '../itemService.js';
import { clearState, renderItemRow, showEmpty, showError, showLoading } from '../ui.js';

const $ = (id) => document.getElementById(id);

function render(items) {
  const card = $('items-table-card');

  if (items.length === 0) {
    card.hidden = true;
    showEmpty($('items-state'), 'No items found', 'There are no items in the inventory yet.');
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
    render(await getItems());
  } catch (error) {
    showError($('items-state'), `Could not load items. ${error.message}`, loadItems);
  }
}

loadItems();