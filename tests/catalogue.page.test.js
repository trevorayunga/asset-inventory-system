/** @jest-environment jsdom */
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { clearCatalogueCache } from '../js/catalogueService.js';
import { PRODUCTS, createMockApi, loadPage, polyfillDialog, sleep, waitFor } from './helpers/mockApi.js';

let mock;
const $ = (id) => document.getElementById(id);
const cards = () => [...document.querySelectorAll('.product-card')];
const dialog = () => document.querySelector('dialog');
const form = () => document.querySelector('dialog form');
const plain = (t) => t.replace(/\u00a0/g, ' ');
const posts = (path) => mock.calls.filter((c) => c.method === 'POST' && c.url.endsWith(path));
const search = (term) => { $('catalogue-search').value = term; $('search-form').requestSubmit(); };

async function openPage() {
  loadPage('catalogue.html');
  await import('../js/pages/catalogue.js?' + Math.random());
  await waitFor(() => !$('product-grid').hidden || $('catalogue-state').textContent.includes('Could not'));
}

beforeEach(() => {
  jest.resetModules();
  polyfillDialog();
  clearCatalogueCache();
  mock = createMockApi();
  mock.catalogue = [...PRODUCTS, { id: 3, title: 'Galaxy Phone', sku: 'PHN-1', price: 500, stock: 3, category: 'smartphones', thumbnail: '' }];
  global.fetch = mock.fetch;
});

describe('Catalogue Import page: browsing', () => {
  test('shows a loading state, then the default laptops with prices in KES', async () => {
    let release;
    const gate = new Promise((resolve) => { release = resolve; });
    const real = mock.fetch;
    global.fetch = async (...a) => { await gate; return real(...a); };
    loadPage('catalogue.html');
    await import('../js/pages/catalogue.js?' + Math.random());
    expect($('catalogue-state').textContent).toContain('Searching catalogue…');
    expect($('product-grid').hidden).toBe(true);
    release();
    await waitFor(() => !$('product-grid').hidden);

    expect(cards()).toHaveLength(3);
    expect(plain(cards()[0].textContent)).toContain('Lenovo Yoga 710');
    expect(plain(cards()[0].textContent)).toContain('KES 103,199');
    expect(cards()[0].textContent).toContain('In stock: 14');
    expect(cards()[0].querySelector('img').getAttribute('alt')).toBe('Lenovo Yoga 710');
    expect(cards()[2].textContent).toContain('No image');
    expect($('catalogue-title').textContent).toBe('Online product catalogue');
    expect($('catalogue-count').textContent).toBe('3 products · prices converted at USD 1 = KES 129');
    expect(mock.calls[0].url).toBe('https://dummyjson.com/products/category/laptops?limit=12');
  });

  test('searching shows the results heading, and an empty search returns to the default list', async () => {
    await openPage();
    search('zen');
    await waitFor(() => cards().length === 1);
    expect($('catalogue-title').textContent).toBe('Results for “zen”');
    expect(mock.calls.at(-1).url).toBe('https://dummyjson.com/products/search?q=zen&limit=12');
    const callsBefore = mock.calls.length;
    search('');
    await waitFor(() => cards().length === 3);
    expect(mock.calls).toHaveLength(callsBefore); // remembered, no new request
  });

  test('no match shows a message and "Clear search" brings the list back', async () => {
    await openPage();
    search('zzzz');
    await waitFor(() => $('catalogue-state').textContent.includes('No matching products'));
    expect($('product-grid').hidden).toBe(true);
    $('catalogue-state').querySelector('[data-empty-action]').click();
    await waitFor(() => cards().length === 3);
    expect($('catalogue-search').value).toBe('');
  });

  test('a network error offers Retry, and Retry recovers', async () => {
    mock.offline = true;
    await openPage();
    expect($('catalogue-state').textContent).toContain('Could not load the catalogue.');
    mock.offline = false;
    $('catalogue-state').querySelector('[data-retry]').click();
    await waitFor(() => cards().length === 3);
  });

  test('a slow older search cannot overwrite a newer one', async () => {
    await openPage();
    const real = mock.fetch;
    global.fetch = async (url, options) => {
      if (String(url).includes('q=slow')) await sleep(150);
      return real(url, options);
    };
    search('slow');
    search('galaxy');
    await waitFor(() => cards().length === 1 && cards()[0].textContent.includes('Galaxy Phone'));
    await sleep(250);
    expect(cards()).toHaveLength(1);
    expect($('catalogue-title').textContent).toBe('Results for “galaxy”');
  });

  test('pressing Enter in the search box runs the search without reloading the page', async () => {
    await openPage();
    const event = new Event('submit', { bubbles: true, cancelable: true });
    $('search-form').dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });
});

describe('Catalogue Import page: importing', () => {
  test('Import opens the add-item form pre-filled, with a guessed category and the KES price', async () => {
    await openPage();
    cards()[0].querySelector('[data-action="import"]').click();
    await waitFor(() => dialog());
    expect(dialog().querySelector('h2').textContent).toBe('Add item');
    const v = (n) => form().querySelector(`[name="${n}"]`).value;
    expect([v('name'), v('sku'), v('categoryId'), v('unitCost'), v('quantity'), v('reorderLevel'), v('status')])
      .toEqual(['Lenovo Yoga 710', 'LAP-LEN-1', '1', '103199', '1', '1', 'active']);
    expect(form().querySelector('.input-prefix span').textContent).toBe('KES');
  });

  test('saving POSTs the item and its opening stock, then the same SKU is refused', async () => {
    await openPage();
    cards()[0].querySelector('[data-action="import"]').click();
    await waitFor(() => dialog());
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(posts('/items')[0].body).toEqual({
      name: 'Lenovo Yoga 710', sku: 'LAP-LEN-1', categoryId: 1, quantity: 1, unitCost: 103199,
      reorderLevel: 1, status: 'active', assignedQuantity: 0,
    });
    expect(posts('/movements')[0].body).toMatchObject({ action: 'receive', quantity: 1, note: 'Initial stock' });
    expect(document.querySelector('.toast').textContent).toBe('Item saved successfully.');
    expect(mock.db.items.at(-1).name).toBe('Lenovo Yoga 710');

    cards()[0].querySelector('[data-action="import"]').click();
    await waitFor(() => dialog());
    form().requestSubmit();
    expect($('err-sku').textContent).toContain('This SKU is already in use.');
    expect(posts('/items')).toHaveLength(1);
  });

  test('an unrecognised catalogue category leaves the category empty so the user must choose', async () => {
    await openPage();
    cards()[2].querySelector('[data-action="import"]').click();
    await waitFor(() => dialog());
    expect(form().querySelector('[name="categoryId"]').value).toBe('');
    expect(form().querySelector('[name="unitCost"]').value).toBe('64500');
    form().requestSubmit();
    expect($('err-categoryId').textContent).toContain('Choose a category.');
    form().querySelector('[name="categoryId"]').value = '4';
    form().requestSubmit();
    await waitFor(() => !dialog());
    expect(mock.db.items.at(-1)).toMatchObject({ name: 'Galaxy Phone', categoryId: 4 });
  });

  test('cancelling saves nothing, and a failure to load categories shows a message', async () => {
    await openPage();
    cards()[0].querySelector('[data-action="import"]').click();
    await waitFor(() => dialog());
    dialog().querySelector('[data-cancel]').click();
    expect(posts('/items')).toHaveLength(0);

    jest.resetModules();
    clearCatalogueCache();
    const failing = createMockApi();
    failing.catalogue = PRODUCTS;
    const real = failing.fetch;
    global.fetch = async (url, options) => (String(url).startsWith('http://localhost:3000') ? { ok: false, status: 500, text: async () => '' } : real(url, options));
    await openPage();
    const button = cards()[0].querySelector('[data-action="import"]');
    button.click();
    await waitFor(() => document.querySelector('.toast-error'));
    expect(document.querySelector('.toast-error').textContent).toContain('Could not prepare the import.');
    expect(button.disabled).toBe(false);
    expect(dialog()).toBeNull();
  });
});
