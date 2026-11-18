import { readFileSync } from 'node:fs';
import axios from 'axios';
import { fileURLToPath } from 'node:url';
import { AppError } from '../utils/errors.js';

const airports = JSON.parse(readFileSync(
  fileURLToPath(new URL('../../../src/data/airports.json', import.meta.url)),
  'utf8'
));
const client = axios.create({ timeout: 6000, maxRedirects: 0 });
const MAX_WEATHER_AGE_SECONDS = 45 * 60;

export async function getAirportWeather(flight, config) {
  if (!config.OPENWEATHER_API_KEY) {
    throw new AppError(503, 'WEATHER_NOT_CONFIGURED', 'Current airport weather is unavailable until an OpenWeather API key is configured.');
  }
  const departure = airports[flight.origin];
  const arrival = airports[flight.destination];
  if (!departure || !arrival) {
    throw new AppError(409, 'WEATHER_AIRPORT_COORDINATES_UNAVAILABLE', 'Open airport coordinates are not available for this flight route.');
  }

  const [departureWeather, arrivalWeather] = await Promise.all([
    fetchWeather(departure, flight.origin, config.OPENWEATHER_API_KEY),
    fetchWeather(arrival, flight.destination, config.OPENWEATHER_API_KEY)
  ]);
  return {
    provider: 'OpenWeather',
    weatherType: 'CURRENT_AIRPORT_CONDITIONS',
    isFlightForecast: false,
    flightNumber: flight.flightNumber,
    route: { origin: flight.origin, destination: flight.destination },
    airports: [departureWeather, arrivalWeather]
  };
}

async function fetchWeather(airport, airportCode, apiKey) {
  let response;
  try {
    response = await client.get('https://api.openweathermap.org/data/2.5/weather', {
      params: {
        lat: airport.latitude,
        lon: airport.longitude,
        appid: apiKey,
        units: 'metric'
      }
    });
  } catch (error) {
    if (axios.isAxiosError(error)) {
      if (error.response?.status === 401) {
        throw new AppError(503, 'WEATHER_PROVIDER_REJECTED_KEY', 'OpenWeather rejected the configured server-side API key.');
      }
      throw new AppError(502, 'WEATHER_PROVIDER_UNAVAILABLE', 'OpenWeather could not provide current airport conditions.');
    }
    throw error;
  }

  return normalizeWeatherRecord(response.data, airportCode);
}

export function normalizeWeatherRecord(record, airportCode, now = Date.now()) {
  const timestamp = Number(record?.dt);
  const temperatureC = Number(record?.main?.temp);
  const windSpeedMps = Number(record?.wind?.speed);
  const condition = record?.weather?.[0]?.main;
  const description = record?.weather?.[0]?.description;
  const observedAt = new Date(timestamp * 1000);
  if (
    !Number.isFinite(timestamp) ||
    !Number.isFinite(temperatureC) ||
    !Number.isFinite(windSpeedMps) ||
    typeof condition !== 'string' ||
    typeof description !== 'string' ||
    Number.isNaN(observedAt.getTime())
  ) {
    throw new AppError(502, 'WEATHER_PROVIDER_INVALID_RESPONSE', 'OpenWeather returned incomplete airport weather data.');
  }
  const ageSeconds = Math.floor((now - observedAt.getTime()) / 1000);
  return {
    airport: airportCode,
    city: typeof record.name === 'string' ? record.name : null,
    condition,
    description,
    temperatureC,
    windSpeedMps,
    observedAt: observedAt.toISOString(),
    freshness: ageSeconds >= 0 && ageSeconds <= MAX_WEATHER_AGE_SECONDS ? 'CURRENT' : 'STALE'
  };
}
