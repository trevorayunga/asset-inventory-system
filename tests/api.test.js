import { beforeEach, describe, expect, test } from '@jest/globals';
import {
  ApiError, buildQuery, del, get, getExternal, patch, post, put, request,
} from '../js/api.js';
import { createMockApi } from './helpers/mockApi.js';

let mock;
beforeEach(() => {
  mock = createMockApi();
  global.fetch = mock.fetch;
});

describe('buildQuery', () => {
  test('builds a query string and skips empty values', () => {
    expect(buildQuery({ a: 1, b: '', c: undefined, d: null })).toBe('?a=1');
    expect(buildQuery({ q: 'two words', limit: 12 })).toBe('?q=two+words&limit=12');
  });
  test('repeats the key for arrays and returns nothing when there are no params', () => {
    expect(buildQuery({ _expand: ['category', 'location'] })).toBe('?_expand=category&_expand=location');
    expect(buildQuery()).toBe('');
    expect(buildQuery({})).toBe('');
  });
});

describe('the five HTTP methods', () => {
  test('GET returns parsed JSON from the API base URL', async () => {
    const categories = await get('/categories');
    expect(categories).toHaveLength(9);
    expect(mock.calls[0]).toMatchObject({ method: 'GET', url: 'http://localhost:3000/categories' });
  });
  test('GET adds query parameters', async () => {
    await get('/items', { _sort: 'name', _expand: 'category' });
    expect(mock.calls[0].url).toBe('http://localhost:3000/items?_sort=name&_expand=category');
  });
  test('POST, PUT, PATCH and DELETE send the right verb and body', async () => {
    const created = await post('/categories', { name: 'Headset', group: 'accessory' });
    expect(created).toMatchObject({ id: 10, name: 'Headset' });
    await put('/categories/10', { name: 'Headset Pro', group: 'accessory' });
    expect(mock.db.categories.at(-1)).toEqual({ id: 10, name: 'Headset Pro', group: 'accessory' });
    await patch('/categories/10', { name: 'Headset X' });
    expect(mock.db.categories.at(-1).name).toBe('Headset X');
    await del('/categories/10');
    expect(mock.db.categories).toHaveLength(9);
    expect(mock.calls.map((c) => c.method)).toEqual(['POST', 'PUT', 'PATCH', 'DELETE']);
    expect(mock.calls[0].body).toEqual({ name: 'Headset', group: 'accessory' });
  });
  test('a GET request carries no body and no Content-Type header', async () => {
    let seen;
    global.fetch = async (url, options) => { seen = options; return mock.fetch(url, options); };
    await get('/categories');
    expect(seen.body).toBeUndefined();
    expect(seen.headers).toEqual({});
    await post('/categories', { name: 'x', group: 'asset' });
    expect(seen.headers['Content-Type']).toBe('application/json');
  });
  test('getExternal calls a full URL', async () => {
    mock.catalogue = [{ id: 1, title: 'A' }];
    const data = await getExternal('https://dummyjson.com/products/search', { q: 'a', limit: 12 });
    expect(data.products).toHaveLength(1);
    expect(mock.calls[0].url).toBe('https://dummyjson.com/products/search?q=a&limit=12');
  });
});

describe('error handling', () => {
  test('an unreachable server becomes a friendly ApiError with status 0', async () => {
    mock.offline = true;
    const error = await get('/items').catch((e) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect(error.status).toBe(0);
    expect(error.message).toMatch(/Network error/);
    expect(error.name).toBe('ApiError');
  });
  test('a missing record becomes a 404 message', async () => {
    const error = await get('/items/999').catch((e) => e);
    expect(error).toMatchObject({ status: 404, message: 'That record could not be found.' });
  });
  test('a server error keeps its status in the message', async () => {
    mock.failNext = true;
    const error = await get('/items').catch((e) => e);
    expect(error.status).toBe(500);
    expect(error.message).toContain('500');
  });
  test('a 204 response and an empty body both give null', async () => {
    global.fetch = async () => ({ ok: true, status: 204, text: async () => '' });
    expect(await request('http://x')).toBeNull();
    global.fetch = async () => ({ ok: true, status: 200, text: async () => '' });
    expect(await request('http://x')).toBeNull();
  });
});
