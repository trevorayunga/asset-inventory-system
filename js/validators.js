// Pure input validation. Each function returns { valid, errors }; errors maps field name -> message.
import { isAssignableGroup } from './stock.js';

export const ITEM_STATUSES = ['active', 'maintenance', 'retired'];

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';
const isWholeNumber = (value) => !isBlank(value) && Number.isInteger(Number(value));

/**
 * existingItems: every item, used for the unique-SKU check.
 * editingId: the id of the item being edited (so its own SKU is allowed).
 * assignedQuantity: units already assigned (edit mode); quantity can't drop below it.
 * categories: needed to stop assigned items moving to a stocked category.
 */
export function validateItem(values, {
  existingItems = [], editingId = null, assignedQuantity = 0, categories = [],
} = {}) {
  const errors = {};

  const name = String(values.name ?? '').trim();
  if (!name) errors.name = 'Name is required.';
  else if (name.length < 2 || name.length > 80) errors.name = 'Name must be 2 to 80 characters.';

  const sku = String(values.sku ?? '').trim();
  if (!sku) {
    errors.sku = 'SKU is required.';
  } else if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sku)) {
    errors.sku = 'SKU can only use letters, numbers, dots, dashes and underscores.';
  } else if (existingItems.some((item) => String(item.id) !== String(editingId)
    && String(item.sku).toLowerCase() === sku.toLowerCase())) {
    errors.sku = 'This SKU is already in use.';
  }

  if (isBlank(values.categoryId)) {
    errors.categoryId = 'Choose a category.';
  } else if (assignedQuantity > 0) {
    const group = categories.find((category) => String(category.id) === String(values.categoryId))?.group;
    if (!isAssignableGroup(group)) {
      errors.categoryId = `${assignedQuantity} units are assigned, so this must stay an asset or accessory category.`;
    }
  }

  if (!isWholeNumber(values.quantity) || Number(values.quantity) < 0) {
    errors.quantity = 'Enter a whole number of 0 or more.';
  } else if (Number(values.quantity) < assignedQuantity) {
    errors.quantity = `Quantity cannot be below the ${assignedQuantity} units already assigned.`;
  }

  if (isBlank(values.unitCost) || Number.isNaN(Number(values.unitCost)) || Number(values.unitCost) < 0) {
    errors.unitCost = 'Enter a cost of 0 or more.';
  }

  if (!isWholeNumber(values.reorderLevel) || Number(values.reorderLevel) < 0) {
    errors.reorderLevel = 'Enter a whole number of 0 or more.';
  }

  if (!ITEM_STATUSES.includes(values.status)) errors.status = 'Choose a valid status.';

  return { valid: Object.keys(errors).length === 0, errors };
}