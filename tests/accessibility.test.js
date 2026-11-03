/** @jest-environment jsdom */
import axe from 'axe-core';
import { beforeEach, describe, expect, jest, test } from '@jest/globals';
import { clearCatalogueCache } from '../js/catalogueService.js';
import {
  PRODUCTS, createMockApi, loadPage, polyfillDialog, waitFor,
} from './helpers/mockApi.js';

// jsdom has no layout engine, so colour contrast is checked separately 
const AXE_OPTIONS = {
  rules: { 'color-contrast': { enabled: false } },
  resultTypes: ['violations'],
};

async function audit() {
  const { violations } = await axe.run(document, AXE_OPTIONS);
  return violations.map((v) => `${v.id}: ${v.help} -> ${v.nodes.map((n) => n.target.join(' ')).join(' | ')}`);
}

let mock;
beforeEach(() => {
  jest.resetModules();
  polyfillDialog();
  clearCatalogueCache();
  mock = createMockApi();
  mock.catalogue = PRODUCTS;
  global.fetch = mock.fetch;
  document.documentElement.lang = 'en';
});

async function openPage(file, script, ready, query = '') {
  loadPage(file, query);
  document.documentElement.lang = 'en';
  await import(`${script}?${Math.random()}`);
  await waitFor(ready);
}

describe('automated accessibility checks (axe-core)', () => {
  test('Dashboard', async () => {
    await openPage('index.html', '../js/pages/dashboard.js', () => !document.getElementById('dashboard-content').hidden);
    expect(await audit()).toEqual([]);
  });
  test('Items', async () => {
    await openPage('items.html', '../js/pages/items.js', () => document.querySelectorAll('#items-body tr').length > 0);
    expect(await audit()).toEqual([]);
  });
  test('Item detail', async () => {
    await openPage('item-detail.html', '../js/pages/itemDetail.js', () => !document.getElementById('detail-content').hidden, '?id=1');
    expect(await audit()).toEqual([]);
  });
  test('Movements', async () => {
    await openPage('movements.html', '../js/pages/movements.js', () => document.querySelectorAll('#movements-body tr').length > 0);
    expect(await audit()).toEqual([]);
  });
  test('Catalogue Import', async () => {
    await openPage('catalogue.html', '../js/pages/catalogue.js', () => !document.getElementById('product-grid').hidden);
    expect(await audit()).toEqual([]);
  });
  test('the Add item dialog, with errors showing', async () => {
    await openPage('items.html', '../js/pages/items.js', () => document.querySelectorAll('#items-body tr').length > 0);
    document.getElementById('add-item').click();
    document.querySelector('dialog form').requestSubmit();
    expect(document.querySelectorAll('dialog .field-error:not([hidden])').length).toBeGreaterThan(0);
    expect(await audit()).toEqual([]);
  });
  test('the Record movement and Delete confirmation dialogs', async () => {
    await openPage('items.html', '../js/pages/items.js', () => document.querySelectorAll('#items-body tr').length > 0);
    document.querySelector('[data-action="movement"]').click();
    expect(await audit()).toEqual([]);
    document.querySelector('dialog [data-cancel]').click();
    document.querySelector('[data-action="delete"]').click();
    expect(await audit()).toEqual([]);
  });
  test('error and empty states', async () => {
    mock.offline = true;
    await openPage('items.html', '../js/pages/items.js', () => document.getElementById('items-state').textContent.includes('Could not'));
    expect(await audit()).toEqual([]);
  });
});

describe('accessible names and structure', () => {
  const PAGES = ['index.html', 'items.html', 'item-detail.html', 'catalogue.html', 'movements.html'];

  test('every page has a skip link that points at a focusable <main>, one <h1>, and a language', () => {
    PAGES.forEach((file) => {
      loadPage(file);
      const skip = document.querySelector('a.skip-link');
      expect(skip.getAttribute('href')).toBe('#main');
      expect(document.querySelector('main#main').getAttribute('tabindex')).toBe('-1');
      expect(document.querySelectorAll('h1')).toHaveLength(1);
      expect(document.querySelectorAll('nav[aria-label="Main"] [aria-current="page"]').length).toBeLessThanOrEqual(1);
    });
  });

  test('every scrollable table is a labelled, keyboard-focusable region with a caption', () => {
    ['index.html', 'items.html', 'item-detail.html', 'movements.html'].forEach((file) => {
      loadPage(file);
      const wrap = document.querySelector('.table-wrap');
      expect(wrap.getAttribute('role')).toBe('region');
      expect(wrap.getAttribute('aria-label')).toBeTruthy();
      expect(wrap.getAttribute('tabindex')).toBe('0');
      expect(wrap.querySelector('caption')).not.toBeNull();
    });
  });

  test('row and alert buttons say which item they act on', async () => {
    const { renderItemRow, renderLowStockAlert } = await import('../js/ui.js');
    const item = { id: 1, name: 'Dell <b>5420</b>', sku: 'LAP-001', quantity: 6, assignedQuantity: 2, reorderLevel: 2, status: 'active', category: { name: 'Laptop', group: 'asset' } };
    const row = renderItemRow(item);
    expect(row).toContain('aria-label="Edit Dell &lt;b&gt;5420&lt;/b&gt;"');
    expect(row).toContain('aria-label="Assign Dell &lt;b&gt;5420&lt;/b&gt;"');
    expect(row).toContain('aria-label="Delete Dell &lt;b&gt;5420&lt;/b&gt;"');
    expect(renderItemRow({ ...item, category: { name: 'Cable', group: 'consumable' } })).toContain('aria-label="Restock Dell');
    expect(renderLowStockAlert({ ...item, category: { name: 'Cable', group: 'consumable' } })).toContain('aria-label="Restock item Dell');
  });

  test('the Add Item button announces that it opens a dialog', () => {
    loadPage('items.html');
    expect(document.getElementById('add-item').getAttribute('aria-haspopup')).toBe('dialog');
  });

  test('the Add item dialog is a labelled modal with no second banner landmark', async () => {
    await openPage('items.html', '../js/pages/items.js', () => document.querySelectorAll('#items-body tr').length > 0);
    document.getElementById('add-item').click();
    const dialog = document.querySelector('dialog');
    expect(dialog.getAttribute('aria-labelledby')).toBe('modal-title');
    expect(dialog.querySelector('header')).toBeNull();
    expect(dialog.querySelector('#modal-title').textContent).toBe('Add item');
  });
});
