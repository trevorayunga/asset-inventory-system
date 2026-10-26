// Generic fetch wrapper: one place for URL building, JSON handling and errors.
import { API_BASE_URL } from './config.js';

/** Calls any full URL (used for the public catalogue API). */
export const getExternal = (fullUrl, params) => request(`${fullUrl}${buildQuery(params)}`);

export class ApiError extends Error {
  constructor(message, status = 0) {
    super(message);
    this.name = 'ApiError';
    this.status = status; // HTTP status, or 0 when the server could not be reached
  }
}

/** Turns an object into a query string, skipping empty values. Arrays repeat the key. */
export function buildQuery(params = {}) {
  const search = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') return;
    if (Array.isArray(value)) value.forEach((entry) => search.append(key, entry));
    else search.append(key, value);
  });
  const query = search.toString();
  return query ? `?${query}` : '';
}

/** Sends a request and returns parsed JSON (or null for an empty response). */
export async function request(url, { method = 'GET', body } = {}) {
  const options = { method, headers: {} };
  if (body !== undefined) {
    options.headers['Content-Type'] = 'application/json';
    options.body = JSON.stringify(body);
  }

  let response;
  try {
    response = await fetch(url, options);
  } catch {
    throw new ApiError('Network error: could not reach the server. Check your connection and try again.');
  }

  if (!response.ok) {
    const message = response.status === 404
      ? 'That record could not be found.'
      : `The server returned an error (status ${response.status}). Try again.`;
    throw new ApiError(message, response.status);
  }
  if (response.status === 204) return null;

  const text = await response.text();
  return text ? JSON.parse(text) : null;
}

const url = (path, params) => `${API_BASE_URL}${path}${buildQuery(params)}`;

export const get = (path, params) => request(url(path, params));
export const post = (path, body) => request(url(path), { method: 'POST', body });
export const put = (path, body) => request(url(path), { method: 'PUT', body });
export const patch = (path, body) => request(url(path), { method: 'PATCH', body });
export const del = (path, params) => request(url(path, params), { method: 'DELETE' });