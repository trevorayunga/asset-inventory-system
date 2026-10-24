// "Record movement" dialog: assign, return, issue, restock or receive.
import {
  openModal, readFormValues, setFormError, setSaving, showFieldErrors,
} from './dialogs.js';
import { getItem } from './itemService.js';
import { recordMovement } from './movementService.js';
import {
  ACTION_FORM_LABELS, assignedUnits, availableUnits, isAssignableGroup, itemGroup,
} from './stock.js';
import { escapeHtml, toast } from './ui.js';
import { validateMovement } from './validators.js';

// Which actions ask "who?" and how the label reads.
const PERSON_LABELS = { assign: 'Assigned to', return: 'Returned by', issue: 'Issued for' };

function stockSummary(item) {
  return isAssignableGroup(itemGroup(item))
    ? `${item.quantity} total · ${availableUnits(item)} available · ${assignedUnits(item)} assigned`
    : `${item.quantity} in stock · reorder level ${item.reorderLevel}`;
}

/** `item` must include its expanded category (the Items page already has that). */
export function openMovementDialog({ item, actions, defaultAction, onSaved }) {
  const selected = actions.includes(defaultAction) ? defaultAction : actions[0];
  const options = actions
    .map((action) => `<option value="${action}"${action === selected ? ' selected' : ''}>${ACTION_FORM_LABELS[action]}</option>`)
    .join('');

  const form = document.createElement('form');
  form.noValidate = true;
  form.innerHTML = `
    <p class="form-error" data-form-error role="alert" hidden></p>
    <p class="muted modal-hint">${escapeHtml(stockSummary(item))}</p>
    <div class="form-grid">
      <div class="field" data-field="action">
        <label for="m-action">Action <span aria-hidden="true">*</span></label>
        <select id="m-action" name="action" aria-required="true" aria-describedby="err-action">${options}</select>
        <p class="field-error" id="err-action" hidden></p>
      </div>
      <div class="field" data-field="quantity">
        <label for="m-quantity">Quantity <span aria-hidden="true">*</span></label>
        <input id="m-quantity" name="quantity" type="number" min="1" step="1" value="1" aria-required="true" aria-describedby="err-quantity">
        <p class="field-error" id="err-quantity" hidden></p>
      </div>
      <div class="field field-wide" data-field="person" data-person>
        <label for="m-person" id="m-person-label"></label>
        <input id="m-person" name="person" type="text" autocomplete="off" aria-describedby="err-person">
        <p class="field-error" id="err-person" hidden></p>
      </div>
      <div class="field field-wide" data-field="note">
        <label for="m-note">Note</label>
        <input id="m-note" name="note" type="text" autocomplete="off" placeholder="Optional, e.g. PO number" aria-describedby="err-note">
        <p class="field-error" id="err-note" hidden></p>
      </div>
    </div>
    <div class="modal-footer">
      <p class="muted">* Required fields</p>
      <button type="button" class="btn btn-secondary" data-cancel>Cancel</button>
      <button type="submit" class="btn btn-primary" data-label="Save movement">Save movement</button>
    </div>`;

  const actionSelect = form.querySelector('#m-action');
  const personField = form.querySelector('[data-person]');
  const personLabel = form.querySelector('#m-person-label');
  const personInput = form.querySelector('#m-person');

  /** Shows the "who?" field only for actions that need it, and labels it for the action. */
  function syncPerson() {
    const action = actionSelect.value;
    const label = PERSON_LABELS[action];
    personField.hidden = !label;
    personInput.setAttribute('aria-required', action === 'assign' ? 'true' : 'false');
    personLabel.innerHTML = label ? `${label}${action === 'assign' ? ' <span aria-hidden="true">*</span>' : ''}` : '';
  }
  actionSelect.addEventListener('change', () => {
    syncPerson();
    showFieldErrors(form, {}); // old messages belonged to the previous action
    setFormError(form, '');
  });
  syncPerson();

  const { close } = openModal({ title: 'Record movement', subtitle: `${item.name} · ${item.sku}`, content: form });
  form.querySelector('[data-cancel]').addEventListener('click', close);

  form.addEventListener('input', (event) => {
    const wrapper = event.target.closest('[data-field]');
    if (!wrapper) return;
    wrapper.querySelector('.field-error').hidden = true;
    event.target.removeAttribute('aria-invalid');
  });

  function fail(errors) {
    showFieldErrors(form, errors);
    form.querySelector('[aria-invalid="true"]')?.focus();
    setSaving(form, false);
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    setFormError(form, '');
    const values = readFormValues(form);
    if (personField.hidden) values.person = ''; // never save text from a hidden field

    // 1) Instant check against what the page already knows.
    let result = validateMovement(item, values);
    if (!result.valid) {
      fail(result.errors);
      return;
    }
    showFieldErrors(form, {});
    setSaving(form, true);

    try {
      // 2) Re-read the item, in case someone else changed the numbers since this page loaded.
      const latest = await getItem(item.id);
      result = validateMovement(latest, values);
      if (!result.valid) {
        fail(result.errors);
        setFormError(form, 'The stock figures changed since this page loaded. Check the numbers and try again.');
        return;
      }
      await recordMovement(latest, values);
    } catch (error) {
      setFormError(form, `Could not save the movement. ${error.message}`);
      setSaving(form, false);
      return;
    }

    toast('Movement recorded.');
    close();
    onSaved?.();
  });
}