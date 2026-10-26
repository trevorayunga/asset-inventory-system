// Rendering helpers. The render functions return strings, so they are easy to test.
import {
  ACTION_LABELS, GROUP_LABELS, displayStatus, isStockedGroup, itemGroup,
} from './stock.js';

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


/* ---------- Money, dates and history rows ---------- */

const KES = new Intl.NumberFormat('en-KE', {
  style: 'currency',
  currency: 'KES',
  currencyDisplay: 'code', // shows "KES 95,000" instead of "Ksh 95,000"
  minimumFractionDigits: 0,
  maximumFractionDigits: 0,
});

export const formatCurrency = (value) => KES.format(Number(value) || 0);

export function formatDate(iso, { short = false } = {}) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  const options = short
    ? { day: 'numeric', month: 'short' }
    : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' };
  return date.toLocaleString('en-GB', options);
}

/** Stock going out shows a minus sign, stock coming in a plus sign. */
export function formatQuantity(action, quantity) {
  if (action === 'issue') return `−${quantity}`;
  if (action === 'restock' || action === 'receive') return `+${quantity}`;
  return String(quantity);
}

/** One row of a movement table. `showItem` adds the item-name column. */
export function renderMovementRow(movement, { showItem = true, shortDate = false } = {}) {
  const note = [movement.person, movement.note].filter(Boolean).join(' · ');
  const itemCell = showItem
    ? `<td>${movement.item ? `<a href="item-detail.html?id=${escapeHtml(movement.itemId)}">${escapeHtml(movement.item.name)}</a>` : '—'}</td>`
    : '';
  return `<tr>
  <td>${escapeHtml(formatDate(movement.date, { short: shortDate }))}</td>
  ${itemCell}
  <td>${escapeHtml(ACTION_LABELS[movement.action] ?? movement.action)}</td>
  <td>${escapeHtml(formatQuantity(movement.action, movement.quantity))}</td>
  <td class="muted">${escapeHtml(note) || '—'}</td>
</tr>`;
}

/** A dashboard card for an item that is running low. */
export function renderLowStockAlert(item) {
  const group = GROUP_LABELS[itemGroup(item)] ?? '';
  return `<article class="alert-item">
  <div class="alert-item-head">
    <h3>${escapeHtml(item.name)}</h3>
    <span class="warn-icon" aria-hidden="true">⚠</span>
  </div>
  ${badge(`Low stock · ${item.quantity} left`, 'warning')}
  <p class="muted">Reorder level: ${escapeHtml(item.reorderLevel)} units</p>
  <p class="muted">${escapeHtml(item.sku)} · ${escapeHtml(group)}</p>
  <button type="button" class="btn btn-secondary" data-action="restock" data-id="${escapeHtml(item.id)}">Restock item</button>
</article>`;
}

/** Writes today's date into the footer <time id="today">. */
export function initPage() {
  const today = document.getElementById('today');
  if (!today) return;
  const now = new Date();
  today.dateTime = now.toISOString();
  today.textContent = now.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}


/* ---------- Catalogue cards---------- */

export function renderProductCard(product, index) {
  const image = product.imageUrl
    ? `<img src="${escapeHtml(product.imageUrl)}" alt="${escapeHtml(product.name)}" loading="lazy" width="200" height="120">`
    : '<span class="muted">No image</span>';
  return `<article class="product-card">
  <div class="product-image">${image}</div>
  <h3>${escapeHtml(product.name)}</h3>
  <p class="product-meta"><span>${escapeHtml(formatCurrency(product.unitCost))}</span><span class="muted">In stock: ${escapeHtml(product.suppliedStock)}</span></p>
  <button type="button" class="btn btn-primary" data-action="import" data-index="${index}" aria-label="Import ${escapeHtml(product.name)}">Import</button>
</article>`;
}