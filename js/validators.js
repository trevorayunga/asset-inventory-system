// Pure input validation. Each function returns { valid, errors }; errors maps field name -> message.

export const ITEM_STATUSES = ['active', 'maintenance', 'retired'];

const isBlank = (value) => value === undefined || value === null || String(value).trim() === '';
const isWholeNumber = (value) => !isBlank(value) && Number.isInteger(Number(value));

export function validateItem(values, { existingItems = [] } = {}) {
  const errors = {};

  const name = String(values.name ?? '').trim();
  if (!name) errors.name = 'Name is required.';
  else if (name.length < 2 || name.length > 80) errors.name = 'Name must be 2 to 80 characters.';

  const sku = String(values.sku ?? '').trim();
  if (!sku) {
    errors.sku = 'SKU is required.';
  } else if (!/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(sku)) {
    errors.sku = 'SKU can only use letters, numbers, dots, dashes and underscores.';
  } else if (existingItems.some((item) => String(item.sku).toLowerCase() === sku.toLowerCase())) {
    errors.sku = 'This SKU is already in use.';
  }

  if (isBlank(values.categoryId)) errors.categoryId = 'Choose a category.';

  if (!isWholeNumber(values.quantity) || Number(values.quantity) < 0) {
    errors.quantity = 'Enter a whole number of 0 or more.';
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