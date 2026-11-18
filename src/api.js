import React from 'react';

const API_BASE_URL = (process.env.REACT_APP_API_BASE_URL || 'http://localhost:4000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(status, code, message, details) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function apiRequest(path, { token, method = 'GET', body, signal } = {}) {
  const headers = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  let response;
  try {
    response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal
    });
  } catch (error) {
    if (error.name === 'AbortError') throw error;
    throw new ApiError(0, 'BACKEND_UNAVAILABLE', 'Cannot reach the FlightSure backend. Start it and try again.');
  }

  let payload;
  try {
    payload = await response.json();
  } catch {
    throw new ApiError(response.status, 'INVALID_BACKEND_RESPONSE', 'The backend returned an unreadable response.');
  }
  if (!response.ok || payload.success !== true) {
    throw new ApiError(
      response.status,
      payload.error?.code || 'REQUEST_FAILED',
      payload.error?.message || 'The request could not be completed.',
      payload.error?.details
    );
  }
  return payload.data;
}

export function useApiQuery(path, token, refreshKey = 0) {
  const [state, setState] = React.useState({ data: null, error: null, loading: Boolean(path) });
  React.useEffect(() => {
    if (!path) {
      setState({ data: null, error: null, loading: false });
      return undefined;
    }
    const controller = new AbortController();
    setState(current => ({ ...current, error: null, loading: true }));
    apiRequest(path, { token, signal: controller.signal })
      .then(data => setState({ data, error: null, loading: false }))
      .catch(error => {
        if (error.name !== 'AbortError') setState({ data: null, error, loading: false });
      });
    return () => controller.abort();
  }, [path, token, refreshKey]);
  return state;
}
