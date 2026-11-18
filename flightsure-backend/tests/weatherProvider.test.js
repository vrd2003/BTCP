import test from 'node:test';
import assert from 'node:assert/strict';
import { getAirportWeather, normalizeWeatherRecord } from '../src/services/weatherProvider.js';

test('requires a configured OpenWeather key instead of inventing airport conditions', async () => {
  await assert.rejects(
    getAirportWeather({ origin: 'JFK', destination: 'LHR' }, {}),
    error => error.code === 'WEATHER_NOT_CONFIGURED'
  );
});

test('labels fresh airport observations as current and old observations as stale', () => {
  const now = Date.parse('2026-11-17T12:00:00Z');
  const current = normalizeWeatherRecord({
    name: 'New York',
    dt: now / 1000 - 300,
    main: { temp: 12.5 },
    wind: { speed: 5.2 },
    weather: [{ main: 'Clouds', description: 'broken clouds' }]
  }, 'JFK', now);
  const stale = normalizeWeatherRecord({
    dt: now / 1000 - 3600,
    main: { temp: 12 },
    wind: { speed: 5 },
    weather: [{ main: 'Clouds', description: 'clouds' }]
  }, 'JFK', now);

  assert.equal(current.freshness, 'CURRENT');
  assert.equal(current.city, 'New York');
  assert.equal(stale.freshness, 'STALE');
});

test('rejects incomplete OpenWeather records', () => {
  assert.throws(
    () => normalizeWeatherRecord({ dt: 1, main: {}, weather: [] }, 'JFK'),
    error => error.code === 'WEATHER_PROVIDER_INVALID_RESPONSE'
  );
});
