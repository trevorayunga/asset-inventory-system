// Pure business logic for groups, availability and status. No DOM and no network.
// Step 8 adds the movement logic (applyMovement and friends) to this file.

export const GROUP_LABELS = {
  asset: 'Asset',
  accessory: 'Accessory',
  component: 'Component',
  consumable: 'Consumable',
};

const ASSIGNABLE_GROUPS = ['asset', 'accessory'];     // handed to people, then returned
const STOCKED_GROUPS = ['component', 'consumable'];   // issued from stock, then restocked

export const isAssignableGroup = (group) => ASSIGNABLE_GROUPS.includes(group);
export const isStockedGroup = (group) => STOCKED_GROUPS.includes(group);

/** The group comes from the item's category (the API expands `category` for us). */
export const itemGroup = (item) => item?.category?.group;

export const assignedUnits = (item) => Number(item?.assignedQuantity) || 0;
export const availableUnits = (item) => Math.max(0, (Number(item?.quantity) || 0) - assignedUnits(item));

/** Low stock only applies to components and consumables, and never to retired items. */
export function isLowStock(item) {
  return isStockedGroup(itemGroup(item))
    && item.status !== 'retired'
    && Number(item.quantity) <= Number(item.reorderLevel);
}

/** The badge shown for an item: calculated from the data, never stored. */
export function displayStatus(item) {
  if (item.status === 'retired') return { key: 'retired', label: 'Retired', variant: 'muted' };
  if (item.status === 'maintenance') return { key: 'maintenance', label: 'In maintenance', variant: 'muted' };
  if (isLowStock(item)) return { key: 'low', label: 'Low stock', variant: 'warning' };
  if (isAssignableGroup(itemGroup(item)) && assignedUnits(item) > 0) {
    return { key: 'assigned', label: `${assignedUnits(item)} assigned`, variant: 'neutral' };
  }
  return { key: 'available', label: 'Available', variant: 'success' };
}

/* ---------- Movements (Step 8) ---------- */

/** Button / menu wording for each action. */
export const ACTION_FORM_LABELS = {
  assign: 'Assign',
  return: 'Return',
  issue: 'Issue',
  restock: 'Restock',
  receive: 'Receive',
};

/** Which actions make sense for an item, decided by its group. */
export function actionsFor(group) {
  if (isAssignableGroup(group)) return ['assign', 'return', 'receive'];
  if (isStockedGroup(group)) return ['issue', 'restock', 'receive'];
  return [];
}

/** Returns the fields to PATCH on the item for a movement. Pure: it does not change `item`. */
export function applyMovement(item, action, quantity) {
  const qty = Number(quantity);
  const inStock = Number(item.quantity) || 0;
  switch (action) {
    case 'assign': return { assignedQuantity: assignedUnits(item) + qty };
    case 'return': return { assignedQuantity: assignedUnits(item) - qty };
    case 'issue': return { quantity: inStock - qty };
    case 'restock':
    case 'receive': return { quantity: inStock + qty };
    default: throw new Error(`Unknown movement action: ${action}`);
  }
}