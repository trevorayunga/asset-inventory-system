// "Add item" dialog (Step 6). Step 7 adds an edit mode to the same dialog.
import { openModal, readFormValues, setFormError, setSaving, showFieldErrors } from './dialogs.js';
import { createItem } from './itemService.js';
import { createMovement } from './movementService.js';
import { GROUP_LABELS } from './stock.js';
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

function buildFormHtml(categories) {
  const describedBy = (name, hint) => `aria-describedby="${hint ? `hint-${name} ` : ''}err-${name}"`;
  const input = (name, type, extra = '', hint = false) => `<input id="f-${name}" name="${name}" type="${type}" aria-required="true" ${describedBy(name, hint)} ${extra}>`;
  const categoryOptions = categories
    .map((category) => `<option value="${escapeHtml(category.id)}">${escapeHtml(category.name)} · ${escapeHtml(GROUP_LABELS[category.group] ?? '')}</option>`)
    .join('');
  const statusOptions = STATUS_OPTIONS.map(([value, label]) => `<option value="${value}">${label}</option>`).join('');

  return `
  <p class="form-error" data-form-error role="alert" hidden></p>
  <div class="form-grid">
    ${field('name', 'Name', input('name', 'text', 'placeholder="Enter item name" autocomplete="off"'))}
    ${field('sku', 'SKU', input('sku', 'text', 'placeholder="e.g. LAP-002" autocomplete="off"'))}
    ${field('categoryId', 'Category', `<select id="f-categoryId" name="categoryId" aria-required="true" ${describedBy('categoryId')}><option value="">Select a category</option>${categoryOptions}</select>`)}
    ${field('status', 'Status', `<select id="f-status" name="status" aria-required="true" ${describedBy('status')}>${statusOptions}</select>`)}
    ${field('quantity', 'Quantity', input('quantity', 'number', 'min="0" step="1" inputmode="numeric"'))}
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

export function openItemDialog({ categories, existingItems = [], onSaved }) {
  const form = document.createElement('form');
  form.noValidate = true; // we show our own messages instead of the browser's
  form.innerHTML = buildFormHtml(categories);

  const { close } = openModal({ title: 'Add item', content: form });
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
    const { valid, errors } = validateItem(raw, { existingItems });
    showFieldErrors(form, errors);
    if (!valid) {
      form.querySelector('[aria-invalid="true"]').focus();
      return;
    }

    const values = normalise(raw);
    setSaving(form, true);
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