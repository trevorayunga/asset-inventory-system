// Catalogue Import: search the public DummyJSON catalogue and import a product as an item.
import { searchCatalogue, suggestCategoryId } from '../catalogueService.js';
import { USD_TO_KES } from '../config.js';
import { openItemDialog } from '../itemForm.js';
import { getCategories, getItems } from '../itemService.js';
import {
  clearState, initPage, renderProductCard, showEmpty, showError, showLoading, toast,
} from '../ui.js';

const $ = (id) => document.getElementById(id);
const state = { products: [], local: null, searchId: 0 };

async function runSearch() {
  const query = $('catalogue-search').value;
  const searchId = ++state.searchId; // lets us ignore an older, slower response
  $('product-grid').hidden = true;
  showLoading($('catalogue-state'), 'Searching catalogue…');
  try {
    const products = await searchCatalogue(query);
    if (searchId !== state.searchId) return;
    state.products = products;
    $('catalogue-title').textContent = query.trim() ? `Results for “${query.trim()}”` : 'Online product catalogue';
    $('catalogue-count').textContent = `${products.length} products · prices converted at USD 1 = KES ${USD_TO_KES}`;
    if (products.length === 0) {
      showEmpty($('catalogue-state'), 'No matching products', 'Try a different product name.', 'Clear search', () => {
        $('catalogue-search').value = '';
        runSearch();
      });
      return;
    }
    clearState($('catalogue-state'));
    $('product-grid').innerHTML = products.map(renderProductCard).join('');
    $('product-grid').hidden = false;
  } catch (error) {
    if (searchId !== state.searchId) return;
    showError($('catalogue-state'), `Could not load the catalogue. ${error.message}`, runSearch);
  }
}

/** Categories and existing items are needed by the form (category list, unique-SKU check). */
async function ensureLocalData() {
  if (!state.local) {
    const [categories, items] = await Promise.all([getCategories(), getItems()]);
    state.local = { categories, items };
  }
  return state.local;
}

async function importProduct(product, button) {
  button.disabled = true;
  try {
    const { categories, items } = await ensureLocalData();
    openItemDialog({
      categories,
      existingItems: items,
      defaults: {
        name: product.name,
        sku: product.sku,
        categoryId: suggestCategoryId(product, categories),
        unitCost: product.unitCost,
        quantity: 1,
        reorderLevel: 1,
      },
      onSaved: () => { state.local = null; }, // reload next time so the new SKU is known
    });
  } catch (error) {
    toast(`Could not prepare the import. ${error.message}`, 'error');
  } finally {
    button.disabled = false;
  }
}

$('search-form').addEventListener('submit', (event) => {
  event.preventDefault();
  runSearch();
});

$('product-grid').addEventListener('click', (event) => {
  const button = event.target.closest('[data-action="import"]');
  if (!button) return;
  importProduct(state.products[Number(button.dataset.index)], button);
});

initPage();
runSearch();