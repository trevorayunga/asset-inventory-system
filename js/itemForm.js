// Add / edit item dialog. Step 6 added "add"; Step 7 adds "edit" using the same form.
import { openModal, readFormValues, setFormError, setSaving, showFieldErrors } from './dialogs.js';
import { createItem, toItemPayload, updateItem } from './itemService.js';
import { createMovement } from './movementService.js';
import { GROUP_LABELS, assignedUnits } from './stock.js';
import { escapeHtml, toast } from './ui.js';
import { validateItem } from './validators.js';

const STATUS_OPTIONS = [
  ['active', 'Active'],
  ['maintenance', 'In maintenance'],
  ['retired', 'Retired'],
];

function field(name, label, control, hint = '') {
  return `<div class="field" data-field="${name}">
    <label for="f-${name}">${label} <span aria-hidden="true">*</span></label>
    ${control}
    ${hint ? `<p class="field-hint" id="hint-${name}">${hint}</p>` : ''}
    <p class="field-error" id="err-${name}" hidden></p>
  </div>`;
}

function buildFormHtml(categories, isEdit) {
  const describedBy = (name, hint) => `aria-describedby="${hint ? `hint-${name} ` : ''}err-${name}"`;
  const input = (name, type, extra = '', hint = false) => `<input id="f-${name}" name="${name}" type="${type}" aria-required="true" ${describedBy(name, hint)} ${extra}>`;
  const categoryOptions = categories
    .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)} · ${escapeHtml(GROUP_LABELS[category.group] ?? '')}</option>`)
    .join('');
  const statusOptions = STATUS_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
  const quantityHint = isEdit ? 'Correcting the count here adds no history entry.' : '';

  return `
  <p class="form-error" data-form-error role="alert" hidden></p>
  <div class="form-grid">
    ${field('name', 'Name', input('name', 'text', 'placeholder="Enter item name" autocomplete="off"'))}
    ${field('sku', 'SKU', input('sku', 'text', 'placeholder="e.g. LAP-002" autocomplete="off"'))}
    ${field('categoryId', 'Category', `<select id="f-categoryId" name="categoryId" aria-required="true" ${describedBy('categoryId')}><option value="">Select a category</option>${categoryOptions}</select>`)}
    ${field('status', 'Status', `<select id="f-status" name="status" aria-required="true" ${describedBy('status')}>${statusOptions}</select>`)}
    ${field('quantity', 'Quantity', input('quantity', 'number', 'min="0" step="1" inputmode="numeric"', Boolean(quantityHint)), quantityHint)}
    ${field('reorderLevel', 'Reorder level', input('reorderLevel', 'number', 'min="0" step="1" inputmode="numeric"', true), 'Used for low-stock alerts on components and consumables.')}
    ${field('unitCost', 'Unit cost', `<div class="input-prefix"><span aria-hidden="true">KES</span>${input('unitCost', 'number', 'min="0" step="1" inputmode="decimal"')}</div>`)}
  </div>
  <div class="modal-footer">
    <p class="muted">* Required fields</p>
    <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
    <button type="submit" class="btn btn-primary" data-label="Save">Save</button>
  </div>`;
}

/** Turns the raw form text into the right types for the API. */
function normalise(values) {
  return {
    name: values.name.trim(),
    sku: values.sku.trim(),
    categoryId: Number(values.categoryId),
    quantity: Number(values.quantity),
    unitCost: Number(values.unitCost),
    reorderLevel: Number(values.reorderLevel),
    status: values.status,
  };
}

/**
 * mode 'add' (default): creates an item.
 * mode 'edit': pass the existing `item`; the form is pre-filled and saved with PUT.
 */
export function openItemDialog({
  mode = 'add', item = null, defaults = null, categories, existingItems = [], onSaved,
}) {
  const isEdit = mode === 'edit';
  const form = document.createElement('form');
  form.noValidate = true; // we show our own messages instead of the browser's
  form.innerHTML = buildFormHtml(categories, isEdit);

  if (isEdit) {
    ['name', 'sku', 'categoryId', 'status', 'quantity', 'reorderLevel', 'unitCost'].forEach((name) => {
           form.querySelector(`[name="${name}"]`).value = item[name];
    });
  } else if (defaults) {
    Object.entries(defaults).forEach(([name, value]) => {
      const control = form.querySelector(`[name="${name}"]`);
      if (control && value !== '' && value !== null && value !== undefined) control.value = value;
    });
  }

  const { close } = openModal({
    title: isEdit ? 'Edit item' : 'Add item',
    subtitle: isEdit ? `${item.name} · ${item.sku}` : '',
    content: form,
  });
  form.querySelector('[data-cancel]').addEventListener('click', close);

  // Clear a field's message as soon as the user edits it.
  form.addEventListener('input', (event) => {
    const wrapper = event.target.closest('[data-field]');
    if (!wrapper) return;
    wrapper.querySelector('.field-error').hidden = true;
    event.target.removeAttribute('aria-invalid');
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFormError(form, '');
    const raw = readFormValues(form);
    const { valid, errors } = validateItem(raw, {
      existingItems,
      editingId: isEdit ? item.id : null,
      assignedQuantity: isEdit ? assignedUnits(item) : 0,
      categories,
    });
    showFieldErrors(form, errors);
    if (!valid) {
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }

    const values = normalise(raw);
    setSaving(form, true);

    if (isEdit) {
      try {
        // PUT replaces the whole record, so keep the stored fields (such as assignedQuantity).
        await updateItem(item.id, { ...toItemPayload(item), ...values });
      } catch (error) {
        setFormError(form, `Could not save the item. ${error.message}`);
        setSaving(form, false);
        return;
      }
      toast('Item updated successfully.');
      close();
      onSaved?.();
      return;
    }

    let created;
    try {
      created = await createItem(values);
    } catch (error) {
      setFormError(form, `Could not save the item. ${error.message}`);
      setSaving(form, false);
      return;
    }

    // Record the opening stock so the item's history adds up to its quantity.
    if (values.quantity > 0) {
      try {
        await createMovement({
          itemId: created.id, action: 'receive', quantity: values.quantity,
          person: '', note: 'Initial stock', date: new Date().toISOString(),
        });
      } catch {
        toast('Item saved, but its opening stock entry could not be recorded.', 'error');
        close();
        onSaved?.();
        return;
      }
    }

    toast('Item saved successfully.');
    close();
    onSaved?.();
  });
}