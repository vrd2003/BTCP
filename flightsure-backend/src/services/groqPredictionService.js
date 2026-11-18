import axios from 'axios';
import { z } from 'zod';
import { AppError } from '../utils/errors.js';

const client = axios.create({ timeout: 20000, maxRedirects: 0 });
const estimateSchema = z.object({
  delayProbability: z.number().min(0).max(1),
  rationale: z.string().trim().min(1).max(500)
}).strict();

export async function generateGroqPrediction(flight, config, httpClient = client) {
  if (!config.GROQ_API_KEY) {
    throw new AppError(503, 'GROQ_NOT_CONFIGURED', 'Add GROQ_API_KEY to the backend environment to enable Groq estimates.');
  }

  let response;
  try {
    response = await httpClient.post('https://api.groq.com/openai/v1/chat/completions', {
      model: config.GROQ_MODEL,
      temperature: 0,
      max_tokens: 600,
      response_format: { type: 'json_object' },
      messages: [
        {
          role: 'system',
          content: 'Respond with exactly one valid JSON object. It must have exactly two keys: "delayProbability" (a number from 0 to 1) and "rationale" (a short string). Example: {"delayProbability":0.4,"rationale":"Limited schedule data; this estimate is uncertain."} Give a cautious, uncalibrated heuristic estimate of the chance that this flight arrives at least 15 minutes late. Use only the supplied flight-provider fields. Do not invent weather, historical statistics, current events, or missing facts. State limitations in the rationale. This is not a trained or statistically validated model and must never be treated as a coverage or compensation decision.'
        },
        {
          role: 'user',
          content: JSON.stringify({
            flightNumber: flight.flightNumber,
            airline: flight.airline || null,
            origin: flight.origin || null,
            destination: flight.destination || null,
            status: flight.status || null,
            scheduledDeparture: flight.scheduledDeparture || null,
            scheduledArrival: flight.scheduledArrival || null,
            actualDeparture: flight.actualDeparture || null,
            actualArrival: flight.actualArrival || null,
            delayMinutes: Number.isFinite(flight.delayMinutes) ? flight.delayMinutes : null,
            providerLastUpdated: flight.lastFetchedAt || null,
            provider: flight.provider || null
          })
        }
      ]
    }, {
      headers: { Authorization: `Bearer ${config.GROQ_API_KEY}` }
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401 || error.response?.status === 403) {
        throw new AppError(503, 'GROQ_KEY_REJECTED', 'Groq rejected the configured API key. Check GROQ_API_KEY in the backend environment.');
      }
      if (error.response?.status === 429) {
        throw new AppError(503, 'GROQ_RATE_LIMITED', 'The Groq API rate limit was reached. Try again later.');
      }
      if (error.response?.status === 400 || error.response?.status === 404) {
        throw new AppError(503, 'GROQ_MODEL_UNAVAILABLE', 'The configured Groq model is unavailable or does not support this request. Check GROQ_MODEL and your Groq project model access.');
      }
      throw new AppError(502, 'GROQ_UNAVAILABLE', 'The Groq prediction service could not complete the request.');
    }
    throw error;
  }

  const content = response.data?.choices?.[0]?.message?.content;
  let estimate;
  try {
    estimate = estimateSchema.parse(JSON.parse(content));
  } catch {
    throw new AppError(502, 'GROQ_INVALID_RESPONSE', 'Groq returned an unusable flight estimate.');
  }

  return {
    ...estimate,
    riskLevel: estimate.delayProbability >= 0.7 ? 'HIGH' : estimate.delayProbability >= 0.35 ? 'MEDIUM' : 'LOW',
    modelVersion: config.GROQ_MODEL,
    predictionTime: new Date(),
    modelMode: 'GROQ_HEURISTIC'
  };
}
