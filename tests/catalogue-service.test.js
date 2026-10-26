import { beforeEach, describe, expect, test } from '@jest/globals';
import { clearCatalogueCache, mapProduct, searchCatalogue, suggestCategoryId } from '../js/catalogueService.js';
import { getExternal } from '../js/api.js';
import { PRODUCTS, createMockApi } from './helpers/mockApi.js';

let mock;
beforeEach(() => {
  mock = createMockApi();
  mock.catalogue = PRODUCTS;
  global.fetch = mock.fetch;
  clearCatalogueCache();
});

describe('mapProduct', () => {
  test('converts the USD price to whole Kenya Shillings and keeps the useful fields', () => {
    expect(mapProduct(PRODUCTS[0])).toEqual({
      externalId: 1, name: 'Lenovo Yoga 710', sku: 'LAP-LEN-1', priceUsd: 799.99, unitCost: 103199,
      suppliedStock: 14, category: 'laptops', imageUrl: 'https://cdn.dummyjson.com/a.webp',
    });
    expect(mapProduct({ id: 2, title: 'X', price: 1099 }).unitCost).toBe(141771);
    expect(mapProduct({ id: 3, title: 'Y', price: 0.5 }).unitCost).toBe(65); // 64.5 rounds up
  });
  test('fills in gaps: missing SKU, price, stock and image', () => {
    expect(mapProduct({ id: 9, title: 'No SKU' })).toMatchObject({
      sku: 'DJ-9', priceUsd: 0, unitCost: 0, suppliedStock: 0, category: '', imageUrl: '',
    });
  });
});

describe('suggestCategoryId', () => {
  const categories = [{ id: 1, name: 'Laptop' }, { id: 4, name: 'Mouse' }, { id: 8, name: 'Cable' }];
  test('matches our category names inside the catalogue slug', () => {
    expect(suggestCategoryId({ category: 'laptops' }, categories)).toBe(1);
    expect(suggestCategoryId({ category: 'mice-and-mouse-pads' }, categories)).toBe(4);
    expect(suggestCategoryId({ category: 'usb-cables' }, categories)).toBe(8);
  });
  test('returns an empty string when it is not sure', () => {
    expect(suggestCategoryId({ category: 'groceries' }, categories)).toBe('');
    expect(suggestCategoryId({}, categories)).toBe('');
  });
});

describe('searchCatalogue', () => {
  test('an empty search lists the default category with a limit', async () => {
    const products = await searchCatalogue('');
    expect(products.map((p) => p.name)).toEqual(['Lenovo Yoga 710', 'Asus Zenbook Pro']);
    expect(mock.calls[0].url).toBe('https://dummyjson.com/products/category/laptops?limit=12');
  });
  test('a keyword search calls the search endpoint with the term', async () => {
    const products = await searchCatalogue('  zenbook ');
    expect(products.map((p) => p.name)).toEqual(['Asus Zenbook Pro']);
    expect(mock.calls[0].url).toBe('https://dummyjson.com/products/search?q=zenbook&limit=12');
  });
  test('repeating a search (any letter case) does not call the API again', async () => {
    await searchCatalogue('zenbook');
    await searchCatalogue('ZENBOOK');
    await searchCatalogue('');
    await searchCatalogue('');
    expect(mock.calls).toHaveLength(2);
  });
  test('an empty or missing product list becomes an empty array, and errors are not cached', async () => {
    mock.catalogue = [];
    expect(await searchCatalogue('nothing')).toEqual([]);
    mock.offline = true;
    await expect(searchCatalogue('fresh')).rejects.toThrow(/Network error/);
    mock.offline = false;
    mock.catalogue = PRODUCTS;
    expect(await searchCatalogue('fresh')).toHaveLength(0);
    expect(await getExternal('https://dummyjson.com/products', { limit: 1 })).toHaveProperty('products');
  });
});
