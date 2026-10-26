// Movements page: the full history, with search, action and date filters.
import { filterMovements, paginate } from '../filters.js';
import { getMovements } from '../movementService.js';
import {
  clearState, debounce, initPage, renderMovementRow, renderPager, showEmpty, showError, showLoading,
} from '../ui.js';

const $ = (id) => document.getElementById(id);
const state = { movements: [], page: 1 };

function currentFilters() {
  return {
    search: $('filter-search').value,
    action: $('filter-action').value,
    from: $('filter-from').value,
    to: $('filter-to').value,
  };
}

function clearFilters() {
  $('filters').reset();
  state.page = 1;
  render();
}

function render() {
  const card = $('movements-card');

  if (state.movements.length === 0) {
    card.hidden = true;
    showEmpty($('movements-state'), 'No movements yet', 'Assign, return, issue or restock an item to start the history.');
    return;
  }

  const matches = filterMovements(state.movements, currentFilters());
  if (matches.length === 0) {
    card.hidden = true;
    showEmpty($('movements-state'), 'No movements found', 'Try another search or clear your filters.', 'Clear filters', clearFilters);
    return;
  }

  const pageInfo = paginate(matches, state.page);
  state.page = pageInfo.page;
  clearState($('movements-state'));
  $('movements-body').innerHTML = pageInfo.items.map((movement) => renderMovementRow(movement)).join('');
  $('movements-count').textContent = `Showing ${pageInfo.from}–${pageInfo.to} of ${pageInfo.total} movements`;
  renderPager($('movements-pager'), pageInfo, (page) => {
    state.page = page;
    render();
  });
  card.hidden = false;
}

async function load() {
  $('movements-card').hidden = true;
  showLoading($('movements-state'), 'Loading movements…');
  try {
    state.movements = await getMovements();
    render();
  } catch (error) {
    showError($('movements-state'), `Could not load movements. ${error.message}`, load);
  }
}

function applyFilters() {
  state.page = 1;
  render();
}
const applyFiltersSoon = debounce(applyFilters, 200);
$('filters').addEventListener('input', (event) => {
  if (event.target.id === 'filter-search') applyFiltersSoon();
  else applyFilters();
});
$('filters').addEventListener('reset', () => setTimeout(applyFilters)); // the form clears itself after this event
$('filters').addEventListener('submit', (event) => event.preventDefault());

initPage();
load();