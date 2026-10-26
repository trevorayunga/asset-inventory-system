// Public API integration: the DummyJSON product catalogue (https://dummyjson.com/docs/products).
import { getExternal } from './api.js';
import { CATALOGUE_BASE_URL, DEFAULT_CATALOGUE_CATEGORY, USD_TO_KES } from './config.js';

const cache = new Map();

/** Turns a DummyJSON product into the fields our item form understands. Prices become KES. */
export function mapProduct(product) {
  const priceUsd = Number(product.price) || 0;
  return {
    externalId: product.id,
    name: product.title,
    sku: product.sku || `DJ-${product.id}`,
    priceUsd,
    unitCost: Math.round(priceUsd * USD_TO_KES),
    suppliedStock: Number(product.stock) || 0,
    category: product.category || '',
    imageUrl: product.thumbnail || '',
  };
}

/** Guesses our category from DummyJSON's ("laptops" -> Laptop). Returns '' when it is not sure. */
export function suggestCategoryId(product, categories) {
  const slug = String(product.category ?? '').toLowerCase();
  const match = categories.find((category) => {
    const name = category.name.toLowerCase();
    return slug.includes(name) || slug.includes(name.replace(/s$/, ''));
  });
  return match ? match.id : '';
}

/**
 * Empty search -> the default category list. Otherwise a keyword search.
 * Results are remembered, so repeating a search does not call the API again.
 */
export async function searchCatalogue(query = '') {
  const term = query.trim();
  const key = term.toLowerCase();
  if (cache.has(key)) return cache.get(key);

  const data = term
    ? await getExternal(`${CATALOGUE_BASE_URL}/products/search`, { q: term, limit: 12 })
    : await getExternal(`${CATALOGUE_BASE_URL}/products/category/${DEFAULT_CATALOGUE_CATEGORY}`, { limit: 12 });

  const products = (data?.products ?? []).map(mapProduct);
  cache.set(key, products);
  return products;
}

export const clearCatalogueCache = () => cache.clear();