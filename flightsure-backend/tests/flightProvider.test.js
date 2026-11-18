import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { searchFlights } from '../src/services/flightProvider.js';

test('reports when AviationStack restricts flight-date searches on the configured plan', async () => {
  const server = http.createServer((_request, response) => {
    response.writeHead(403, { 'content-type': 'application/json' });
    response.end(JSON.stringify({ error: { code: 'function_access_restricted' } }));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();

  try {
    await assert.rejects(
      searchFlights(
        { origin: 'JFK', destination: 'DEL', date: '2026-11-17', limit: 20 },
        { FLIGHT_PROVIDER_API_KEY: 'test-key-not-a-secret', FLIGHT_PROVIDER_URL: `http://127.0.0.1:${port}/flights` }
      ),
      error => error.code === 'FLIGHT_PROVIDER_DATE_FILTER_RESTRICTED' &&
        error.details.restrictedFilter === 'flight_date' &&
        !JSON.stringify(error).includes('test-key-not-a-secret')
    );
  } finally {
    await new Promise((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
