// Native <dialog> helpers: focus is trapped, Esc closes, and focus returns to the opener.
import { escapeHtml } from './ui.js';

export function openModal({ title, subtitle = '', content, onClose }) {
  const dialog = document.createElement('dialog');
  dialog.className = 'modal';
  dialog.setAttribute('aria-labelledby', 'modal-title');
  dialog.innerHTML = `<div class="modal-panel">
    <header class="modal-header">
      <div>
        <h2 id="modal-title">${escapeHtml(title)}</h2>
        ${subtitle ? `<p class="muted">${escapeHtml(subtitle)}</p>` : ''}
      </div>
      <button type="button" class="icon-btn" data-close aria-label="Close dialog">×</button>
    </header>
    <div class="modal-body"></div>
  </div>`;
  dialog.querySelector('.modal-body').append(content);
  document.body.append(dialog);

  const opener = document.activeElement;
  const close = () => dialog.close();
  dialog.addEventListener('close', () => {
    dialog.remove();
    opener?.focus?.();
    onClose?.();
  });
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) close(); // click on the dimmed backdrop
  });
  dialog.querySelector('[data-close]').addEventListener('click', close);
  dialog.showModal();
  return { dialog, close };
}

/** Reads every named control's current value. */
export function readFormValues(form) {
  return Object.fromEntries([...form.querySelectorAll('[name]')].map((control) => [control.name, control.value]));
}

/** Shows or clears the message under each field, and flags the input for screen readers. */
export function showFieldErrors(form, errors) {
  form.querySelectorAll('[data-field]').forEach((wrapper) => {
    const input = wrapper.querySelector('input, select');
    const message = wrapper.querySelector('.field-error');
    const text = errors[wrapper.dataset.field];
    message.hidden = !text;
    message.innerHTML = text ? `<span aria-hidden="true">⚠</span> ${escapeHtml(text)}` : '';
    if (text) input.setAttribute('aria-invalid', 'true');
    else input.removeAttribute('aria-invalid');
  });
}

export function setFormError(form, message) {
  const box = form.querySelector('[data-form-error]');
  box.hidden = !message;
  box.textContent = message || '';
}

export function setSaving(form, saving) {
  const button = form.querySelector('[type="submit"]');
  button.disabled = saving;
  button.textContent = saving ? 'Saving…' : button.dataset.label;
}