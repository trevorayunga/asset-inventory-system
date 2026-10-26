// Item-related API calls: GET, POST, PUT, PATCH and DELETE.
import { del, get, patch, post, put } from './api.js';

const ITEM_FIELDS = [
  'name', 'sku', 'categoryId', 'quantity', 'assignedQuantity', 'unitCost', 'reorderLevel', 'status',
];

/** Keeps only the stored fields, dropping expanded objects such as `category`. */
export function toItemPayload(source) {
  const payload = {};
  ITEM_FIELDS.forEach((field) => {
    if (source[field] !== undefined) payload[field] = source[field];
  });
  return payload;
}

export const getItems = () => get('/items', { _expand: 'category', _sort: 'name' });
export const getItem = (id) => get(`/items/${id}`, { _expand: 'category' });
export const createItem = (values) => post('/items', toItemPayload({ assignedQuantity: 0, ...values }));
export const updateItem = (id, values) => put(`/items/${id}`, toItemPayload(values));
export const patchItem = (id, changes) => patch(`/items/${id}`, changes);
export const deleteItem = (id) => del(`/items/${id}`, { _dependent: 'movements' });
export const getCategories = () => get('/categories');