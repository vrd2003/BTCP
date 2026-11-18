import test from 'node:test';
import assert from 'node:assert/strict';
import request from 'supertest';
import { createApp } from '../src/app.js';
import { recentFlightsSchema } from '../src/validators/schemas.js';
import { errorHandler } from '../src/middleware/errors.js';
import { AppError } from '../src/utils/errors.js';

const config = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: 'test-only-secret-that-is-long-enough-to-satisfy-validation',
  JWT_ACCESS_TTL: '15m',
  clientOrigins: ['http://localhost:3000'],
  POLICY_CATALOG: [],
  FLIGHT_PROVIDER_URL: undefined,
  FLIGHT_PROVIDER_API_KEY: undefined,
  GROQ_API_KEY: undefined
};

test('exposes liveness independently from database readiness', async () => {
  const app = createApp(config, { readyState: 0 });
  const live = await request(app).get('/api/health/live');
  const ready = await request(app).get('/api/health/ready');
  assert.equal(live.status, 200);
  assert.equal(live.body.data.status, 'ok');
  assert.equal(ready.status, 503);
  assert.equal(ready.body.data.database, 'disconnected');
  assert.equal(ready.body.data.weatherConfigured, false);
});

test('protects account routes and reports invalid requests consistently', async () => {
  const app = createApp(config, { readyState: 0 });
  const protectedResponse = await request(app).get('/api/auth/me');
  const invalidRegistration = await request(app).post('/api/auth/register').send({
    name: '',
    email: 'not-an-email',
    password: 'short'
  });
  assert.equal(protectedResponse.status, 401);
  assert.equal(protectedResponse.body.error.code, 'AUTHENTICATION_REQUIRED');
  assert.equal(invalidRegistration.status, 400);
  assert.equal(invalidRegistration.body.error.code, 'VALIDATION_ERROR');
});

test('does not silently invent provider search results', async () => {
  const app = createApp(config, { readyState: 0 });
  const response = await request(app)
    .get('/api/flights/search?origin=JFK&destination=LHR&date=2026-11-17')
    .set('Authorization', 'Bearer invalid');
  assert.equal(response.status, 401);
  assert.equal(response.body.success, false);
});

test('validates the recent-flight feed limit', () => {
  assert.equal(recentFlightsSchema.safeParse({}).success, true);
  assert.equal(recentFlightsSchema.safeParse({ limit: '50' }).success, true);
  assert.equal(recentFlightsSchema.safeParse({ limit: '51' }).success, false);
  assert.equal(recentFlightsSchema.safeParse({ limit: '10', unexpected: 'value' }).success, false);
});

test('preserves actionable messages for expected integration errors without exposing unexpected server errors', () => {
  const responseFor = error => {
    const response = {
      status(status) { this.statusCode = status; return this; },
      json(body) { this.body = body; return this; }
    };
    errorHandler(error, {}, response, () => {});
    return response;
  };

  const integrationError = responseFor(new AppError(503, 'GROQ_NOT_CONFIGURED', 'Configure GROQ_API_KEY.'));
  const internalError = responseFor(new Error('database connection string must remain private'));
  assert.equal(integrationError.body.error.message, 'Configure GROQ_API_KEY.');
  assert.equal(internalError.body.error.message, 'The server could not complete the request.');
  assert.notEqual(internalError.body.error.message, 'database connection string must remain private');
});
