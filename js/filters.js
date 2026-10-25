// Pure searching, filtering, sorting and pagination helpers. No DOM and no network.
import { PAGE_SIZE } from './config.js';
import { itemGroup, matchesStatus } from './stock.js';

const lower = (value) => String(value ?? '').toLowerCase();

/** Every filter is optional; an empty value means "don't filter on this". */
export function filterItems(items, {
  search = '', categoryId = '', group = '', status = '',
} = {}) {
  const term = lower(search).trim();
  return items.filter((item) => {
    if (term && !`${lower(item.name)} ${lower(item.sku)}`.includes(term)) return false;
    if (categoryId && String(item.categoryId) !== String(categoryId)) return false;
    if (group && itemGroup(item) !== group) return false;
    return matchesStatus(item, status);
  });
}

const byName = (a, b) => String(a.name).localeCompare(String(b.name), undefined, { sensitivity: 'base' });

const SORTERS = {
  'name-asc': byName,
  'name-desc': (a, b) => byName(b, a),
  'quantity-asc': (a, b) => a.quantity - b.quantity || byName(a, b),
  'quantity-desc': (a, b) => b.quantity - a.quantity || byName(a, b),
  'cost-desc': (a, b) => b.unitCost - a.unitCost || byName(a, b),
};

/** Returns a sorted copy; an unknown key falls back to name A-Z. */
export function sortItems(items, key = 'name-asc') {
  return [...items].sort(SORTERS[key] ?? SORTERS['name-asc']);
}

/** Slices one page and reports where it sits in the whole list. */
export function paginate(list, page = 1, pageSize = PAGE_SIZE) {
  const total = list.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const current = Math.min(Math.max(1, Number(page) || 1), totalPages);
  const start = (current - 1) * pageSize;
  const items = list.slice(start, start + pageSize);
  return {
    items,
    page: current,
    totalPages,
    total,
    from: total === 0 ? 0 : start + 1,
    to: start + items.length,
  };
}