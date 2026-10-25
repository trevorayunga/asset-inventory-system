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

export function showEmpty(container, title, hint = '', actionLabel = '', onAction = null) {
  container.hidden = false;
  container.innerHTML = `<div class="state state-empty">
    <div>
      <p class="state-title">${escapeHtml(title)}</p>
      ${hint ? `<p class="muted">${escapeHtml(hint)}</p>` : ''}
    </div>
    ${actionLabel ? `<button type="button" class="link-btn" data-empty-action>${escapeHtml(actionLabel)}</button>` : ''}
  </div>`;
  if (onAction) container.querySelector('[data-empty-action]')?.addEventListener('click', onAction);
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


/* ---------- Filters and pagination ---------- */

/** Runs `fn` only after the user has stopped typing for `wait` milliseconds. */
export function debounce(fn, wait = 200) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), wait);
  };
}

/** Fills a <select> with options (value = id, text = name), keeping an "all" choice first. */
export function fillSelect(select, options, placeholder) {
  const first = placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : '';
  select.innerHTML = first + options
    .map((option) => `<option value="${escapeHtml(option.id)}">${escapeHtml(option.name)}</option>`)
    .join('');
}

/** Draws Previous / page numbers / Next, and calls onPage(number) when one is clicked. */
export function renderPager(container, { page, totalPages }, onPage) {
  if (totalPages <= 1) {
    container.innerHTML = '';
    return;
  }
  const numbers = Array.from({ length: totalPages }, (_, index) => index + 1)
    .map((number) => `<button type="button" class="pager-btn${number === page ? ' is-current' : ''}" data-page="${number}"${number === page ? ' aria-current="page"' : ''} aria-label="Page ${number}">${number}</button>`)
    .join('');
  container.innerHTML = `<button type="button" class="pager-btn" data-page="${page - 1}"${page === 1 ? ' disabled' : ''}>Previous</button>${numbers}<button type="button" class="pager-btn" data-page="${page + 1}"${page === totalPages ? ' disabled' : ''}>Next</button>`;
  container.onclick = (event) => {
    const button = event.target.closest('[data-page]');
    if (button && !button.disabled) onPage(Number(button.dataset.page));
  };
}