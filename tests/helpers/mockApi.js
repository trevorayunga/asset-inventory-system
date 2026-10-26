// A tiny in-memory stand-in for JSON Server (and the DummyJSON catalogue) used by the tests.
// It starts from tests/fixtures/db.json (a frozen copy of the seed data), never from your live db.json.
import fs from 'node:fs';

const PLURAL = { category: 'categories', location: 'locations', item: 'items' };

export function createMockApi() {
  const db = JSON.parse(fs.readFileSync(new URL('../fixtures/db.json', import.meta.url), 'utf8'));
  const calls = [];
  const api = { db, calls, offline: false, failNext: false, catalogue: [] };

  const reply = (status, data) => ({
    ok: status >= 200 && status < 300,
    status,
    text: async () => (data === undefined ? '' : JSON.stringify(data)),
  });

  const expand = (row, expands) => {
    const copy = { ...row };
    expands.forEach((name) => {
      copy[name] = db[PLURAL[name]].find((entry) => entry.id === row[`${name}Id`]);
    });
    return copy;
  };

  api.fetch = async (rawUrl, options = {}) => {
    const method = options.method || 'GET';
    calls.push({ url: rawUrl, method, body: options.body ? JSON.parse(options.body) : undefined });
    if (api.offline) throw new TypeError('Failed to fetch');
    if (api.failNext) {
      api.failNext = false;
      return reply(500, { error: 'boom' });
    }

    const url = new URL(rawUrl);
    if (url.hostname === 'dummyjson.com') {
      const term = url.searchParams.get('q');
      const products = term
        ? api.catalogue.filter((p) => p.title.toLowerCase().includes(term.toLowerCase()))
        : api.catalogue;
      return reply(200, { products, total: products.length });
    }

    const [collection, id] = url.pathname.split('/').filter(Boolean);
    const rows = db[collection];
    if (!rows) return reply(404, {});
    const expands = url.searchParams.getAll('_expand');
    const body = options.body ? JSON.parse(options.body) : {};

    if (method === 'GET' && id === undefined) {
      let list = rows.filter((row) => [...url.searchParams.entries()]
        .filter(([key]) => !key.startsWith('_'))
        .every(([key, value]) => String(row[key]) === value));
      const sort = url.searchParams.get('_sort');
      if (sort) {
        const dir = url.searchParams.get('_order') === 'desc' ? -1 : 1;
        list = [...list].sort((a, b) => (a[sort] > b[sort] ? 1 : a[sort] < b[sort] ? -1 : 0) * dir);
      }
      const limit = url.searchParams.get('_limit');
      if (limit) list = list.slice(0, Number(limit));
      return reply(200, list.map((row) => expand(row, expands)));
    }

    const index = rows.findIndex((row) => String(row.id) === id);
    if (method === 'POST') {
      const created = { id: Math.max(0, ...rows.map((r) => r.id)) + 1, ...body };
      rows.push(created);
      return reply(201, created);
    }
    if (index === -1) return reply(404, {});
    if (method === 'GET') return reply(200, expand(rows[index], expands));
    if (method === 'PUT') { rows[index] = { id: rows[index].id, ...body }; return reply(200, rows[index]); }
    if (method === 'PATCH') { rows[index] = { ...rows[index], ...body }; return reply(200, rows[index]); }
    if (method === 'DELETE') {
      const [removed] = rows.splice(index, 1);
      if (url.searchParams.get('_dependent') === 'movements') {
        db.movements = db.movements.filter((m) => m.itemId !== removed.id);
      }
      return reply(200, {});
    }
    return reply(405, {});
  };
  return api;
}

export const PRODUCTS = [
  { id: 1, title: 'Lenovo Yoga 710', sku: 'LAP-LEN-1', price: 799.99, stock: 14, category: 'laptops', thumbnail: 'https://cdn.dummyjson.com/a.webp' },
  { id: 2, title: 'Asus Zenbook Pro', sku: 'LAP-ASU-2', price: 1099, stock: 6, category: 'laptops', thumbnail: 'https://cdn.dummyjson.com/b.webp' },
];

export const sleep = (ms = 0) => new Promise((resolve) => setTimeout(resolve, ms));

export async function waitFor(check, timeout = 2000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    if (check()) return;
    await sleep(10);
  }
  throw new Error('waitFor timed out');
}

/** Puts a page's <body> markup (without its script tag) into the jsdom document. */
export function loadPage(file, query = '') {
  const html = fs.readFileSync(new URL(`../../${file}`, import.meta.url), 'utf8');
  const body = html.match(/<body>([\s\S]*)<\/body>/)[1].replace(/<script[\s\S]*?<\/script>/g, '');
  document.body.innerHTML = body;
  window.history.pushState({}, '', `/${file}${query}`);
}

/** jsdom has no <dialog> support, so give it the minimum behaviour the app relies on. */
export function polyfillDialog() {
  window.HTMLDialogElement.prototype.showModal = function showModal() { this.setAttribute('open', ''); };
  window.HTMLDialogElement.prototype.close = function close() {
    this.removeAttribute('open');
    this.dispatchEvent(new Event('close'));
  };
}
