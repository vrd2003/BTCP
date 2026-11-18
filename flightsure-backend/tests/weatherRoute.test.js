import test from 'node:test';
import assert from 'node:assert/strict';
import jwt from 'jsonwebtoken';
import request from 'supertest';
import { createApp } from '../src/app.js';
import Flight from '../src/models/Flight.js';
import User from '../src/models/User.js';

const accessSecret = 'test-only-secret-that-is-long-enough-to-satisfy-validation';
const config = {
  NODE_ENV: 'test',
  JWT_ACCESS_SECRET: accessSecret,
  JWT_ACCESS_TTL: '15m',
  clientOrigins: ['http://localhost:3000'],
  POLICY_CATALOG: [],
  OPENWEATHER_API_KEY: undefined
};

test('authenticated weather route reports unavailable when OpenWeather is not configured', async () => {
  const originalFindFlight = Flight.findById;
  const originalFindUser = User.findById;
  Flight.findById = async () => ({
    flightNumber: 'FS123',
    origin: 'JFK',
    destination: 'LHR'
  });
  User.findById = () => ({
    select: async () => ({ _id: '507f1f77bcf86cd799439011', tokenVersion: 0 })
  });

  try {
    const token = jwt.sign({ sub: '507f1f77bcf86cd799439011', tokenVersion: 0 }, accessSecret);
    const response = await request(createApp(config, { readyState: 1 }))
      .get('/api/flights/507f1f77bcf86cd799439011/weather')
      .set('Authorization', `Bearer ${token}`);

    assert.equal(response.status, 503);
    assert.equal(response.body.error.code, 'WEATHER_NOT_CONFIGURED');
  } finally {
    Flight.findById = originalFindFlight;
    User.findById = originalFindUser;
  }
});
