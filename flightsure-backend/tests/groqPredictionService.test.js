import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import { generateGroqPrediction } from '../src/services/groqPredictionService.js';

const flight = {
  flightNumber: 'AI102',
  airline: 'Air India',
  origin: 'JFK',
  destination: 'DEL',
  status: 'scheduled',
  scheduledDeparture: new Date('2026-12-01T10:00:00Z'),
  scheduledArrival: new Date('2026-12-01T20:00:00Z'),
  actualDeparture: null,
  actualArrival: null,
  delayMinutes: undefined,
  lastFetchedAt: new Date('2026-11-17T10:00:00Z'),
  provider: 'aviationstack'
};

test('requires a server-side Groq key', async () => {
  await assert.rejects(
    generateGroqPrediction(flight, { GROQ_MODEL: 'openai/gpt-oss-120b' }),
    error => error.code === 'GROQ_NOT_CONFIGURED'
  );
});

test('requests a structured, uncalibrated estimate using only provider flight fields', async () => {
  let captured;
  const result = await generateGroqPrediction(
    flight,
    { GROQ_API_KEY: 'test-key-not-a-secret', GROQ_MODEL: 'openai/gpt-oss-120b' },
    { post: async (...args) => {
      captured = args;
      return { data: { choices: [{ message: { content: JSON.stringify({
        delayProbability: 0.72,
        rationale: 'The available schedule and status fields suggest elevated risk, but no history or weather was provided.'
      }) } }] } };
    } }
  );

  assert.equal(captured[0], 'https://api.groq.com/openai/v1/chat/completions');
  assert.equal(captured[1].model, 'openai/gpt-oss-120b');
  assert.equal(captured[1].response_format.type, 'json_object');
  assert.equal(captured[2].headers.Authorization, 'Bearer test-key-not-a-secret');
  assert.equal(captured[1].max_tokens, 600);
  assert.match(captured[1].messages[0].content, /\{"delayProbability":0\.4,"rationale":/);
  assert.equal(captured[1].messages[1].content.includes('AI102'), true);
  assert.equal(captured[1].messages[1].content.includes('weather'), false);
  assert.equal(result.riskLevel, 'HIGH');
  assert.equal(result.modelMode, 'GROQ_HEURISTIC');
  assert.equal(result.modelVersion, 'openai/gpt-oss-120b');
  assert.equal(result.rationale.startsWith('The available schedule'), true);
});

test('rejects invalid structured estimate output', async () => {
  await assert.rejects(
    generateGroqPrediction(
      flight,
      { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'openai/gpt-oss-120b' },
      { post: async () => ({ data: { choices: [{ message: { content: '{"delayProbability":2,"rationale":"invalid"}' } }] } }) }
    ),
    error => error.code === 'GROQ_INVALID_RESPONSE'
  );
});

test('maps Groq authentication failures without leaking request credentials', async () => {
  const providerError = new axios.AxiosError('unauthorized');
  providerError.response = { status: 401 };
  await assert.rejects(
    generateGroqPrediction(
      flight,
      { GROQ_API_KEY: 'test-key-not-a-secret', GROQ_MODEL: 'openai/gpt-oss-120b' },
      { post: async () => { throw providerError; } }
    ),
    error => error.code === 'GROQ_KEY_REJECTED' &&
      !JSON.stringify(error).includes('test-key-not-a-secret')
  );
});

test('reports model access errors clearly', async () => {
  const providerError = new axios.AxiosError('model not found');
  providerError.response = { status: 404 };
  await assert.rejects(
    generateGroqPrediction(
      flight,
      { GROQ_API_KEY: 'test-key', GROQ_MODEL: 'unavailable-model' },
      { post: async () => { throw providerError; } }
    ),
    error => error.code === 'GROQ_MODEL_UNAVAILABLE' && error.message.includes('GROQ_MODEL')
  );
});
