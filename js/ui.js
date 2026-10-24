// Rendering helpers. The render functions return strings, so they are easy to test.
import { GROUP_LABELS, displayStatus, isStockedGroup, itemGroup } from './stock.js';

const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };

/** Always escape user data before putting it into HTML. */
export const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (char) => ESCAPES[char]);

export const badge = (label, variant = 'neutral') => `<span class="badge badge-${variant}">${escapeHtml(label)}</span>`;

export function renderItemRow(item) {
  const status = displayStatus(item);
  const group = itemGroup(item);
  const primaryAction = isStockedGroup(group) ? 'Restock' : 'Assign';
  const id = escapeHtml(item.id);
  return `<tr>
  <td><a href="item-detail.html?id=${id}">${escapeHtml(item.name)}</a></td>
  <td>${escapeHtml(item.sku)}</td>
  <td>${escapeHtml(item.category?.name ?? '—')}</td>
  <td>${escapeHtml(GROUP_LABELS[group] ?? '—')}</td>
  <td>${escapeHtml(item.quantity)}</td>
  <td>${badge(status.label, status.variant)}</td>
  <td><div class="row-actions">
    <button type="button" class="link-btn" data-action="edit" data-id="${id}">Edit</button>
    <button type="button" class="link-btn" data-action="movement" data-id="${id}">${primaryAction}</button>
    <button type="button" class="link-btn" data-action="delete" data-id="${id}">Delete</button>
  </div></td>
</tr>`;
}

/* ---------- Page states: loading, error, empty ---------- */

export function showLoading(container, text = 'Loading…') {
  container.hidden = false;
  container.innerHTML = `<div class="state" role="status"><span class="spinner" aria-hidden="true"></span><span>${escapeHtml(text)}</span></div>`;
}

export function showError(container, message, onRetry) {
  container.hidden = false;
  container.innerHTML = `<div class="state state-error" role="alert">
    <span aria-hidden="true">⚠</span>
    <span>${escapeHtml(message)}</span>
    ${onRetry ? '<button type="button" class="link-btn" data-retry>Retry</button>' : ''}
  </div>`;
  container.querySelector('[data-retry]')?.addEventListener('click', onRetry);
}

export function showEmpty(container, title, hint = '') {
  container.hidden = false;
  container.innerHTML = `<div class="state state-empty">
    <div>
      <p class="state-title">${escapeHtml(title)}</p>
      ${hint ? `<p class="muted">${escapeHtml(hint)}</p>` : ''}
    </div>
  </div>`;
}

export function clearState(container) {
  container.innerHTML = '';
  container.hidden = true;
}

/* ---------- Toast messages ---------- */

export function toast(message, type = 'success') {
  const region = document.getElementById('toast-region');
  if (!region) return;
  const element = document.createElement('div');
  element.className = `toast toast-${type}`;
  element.textContent = message;
  region.append(element);
  setTimeout(() => element.remove(), 4500);
}