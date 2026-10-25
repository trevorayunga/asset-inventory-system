// Pure business logic for groups, availability and status. No DOM and no network.
//  adds the movement logic (applyMovement and friends) to this file.

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

/* ---------- Movements ---------- */

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

/** Used by the status filter on the Items page. '' means "all statuses". */
export function matchesStatus(item, filter) {
  switch (filter) {
    case 'assigned': return isAssignableGroup(itemGroup(item)) && assignedUnits(item) > 0;
    case 'low': return isLowStock(item);
    case 'maintenance': return item.status === 'maintenance';
    case 'retired': return item.status === 'retired';
    case 'available': return item.status === 'active' && !isLowStock(item) && availableUnits(item) > 0;
    default: return true;
  }
}


/* ---------- Summaries and wording for the dashboard and detail pages ---------- */

/** History wording: "Assigned", "Restocked"... */
export const ACTION_LABELS = {
  assign: 'Assigned',
  return: 'Returned',
  issue: 'Issued',
  restock: 'Restocked',
  receive: 'Received',
};

const roundMoney = (value) => Math.round(value * 100) / 100;

export function totalValue(items) {
  return roundMoney(items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unitCost) || 0), 0));
}

/** All the figures the dashboard shows, worked out from the item list. */
export function getSummary(items) {
  const assignable = items.filter((item) => isAssignableGroup(itemGroup(item)));
  const stocked = items.filter((item) => isStockedGroup(itemGroup(item)));
  const sum = (list, pick) => list.reduce((total, item) => total + pick(item), 0);
  return {
    itemRecords: items.length,
    totalUnits: sum(items, (item) => Number(item.quantity) || 0),
    totalValue: totalValue(items),
    lowStock: items.filter(isLowStock),
    assignableUnits: sum(assignable, (item) => Number(item.quantity) || 0),
    assignableValue: totalValue(assignable),
    assignedUnits: sum(assignable, assignedUnits),
    availableToAssign: sum(assignable, availableUnits),
    stockedUnits: sum(stocked, (item) => Number(item.quantity) || 0),
    stockedValue: totalValue(stocked),
  };
}

/** "6 total · 4 available" for things that are assigned, "4 in stock" for things that are used up. */
export function describeStock(item) {
  return isAssignableGroup(itemGroup(item))
    ? `${item.quantity} total · ${availableUnits(item)} available`
    : `${item.quantity} in stock`;
}

/** Who holds an item. `movements` should be newest first. */
export function describeAssignment(item, movements = []) {
  if (!isAssignableGroup(itemGroup(item))) return 'Not applicable';
  const count = assignedUnits(item);
  if (count === 0) return 'Not assigned';
  const latest = movements.find((movement) => movement.action === 'assign' && movement.person);
  const units = `${count} unit${count === 1 ? '' : 's'} assigned`;
  return latest ? `${units} · latest: ${latest.person}` : units;
}