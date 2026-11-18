import axios from 'axios';
import Flight from '../models/Flight.js';
import FlightSourceRecord from '../models/FlightSourceRecord.js';
import { AppError } from '../utils/errors.js';

const client = axios.create({ timeout: 8000, maxRedirects: 0 });

export async function searchFlights(query, config) {
  if (!config.FLIGHT_PROVIDER_API_KEY || !config.FLIGHT_PROVIDER_URL) {
    throw new AppError(503, 'FLIGHT_PROVIDER_NOT_CONFIGURED', 'Flight search is unavailable until a flight-data provider is configured.');
  }
  const params = {
    access_key: config.FLIGHT_PROVIDER_API_KEY,
    limit: query.limit
  };
  if (query.flightNumber) params.flight_iata = query.flightNumber.replace(/\s+/g, '').toUpperCase();
  if (query.origin) params.dep_iata = query.origin;
  if (query.destination) params.arr_iata = query.destination;
  if (query.date) params.flight_date = query.date;

  const result = await requestWithRetry(config.FLIGHT_PROVIDER_URL, params);
  if (!Array.isArray(result.data)) {
    throw new AppError(502, 'FLIGHT_PROVIDER_INVALID_RESPONSE', 'The flight-data provider returned an unsupported response.');
  }
  const flights = await Promise.all(result.data.map(record => persistFlight(normalizeAviationStack(record))));
  return flights.filter(Boolean);
}

export async function getFlightById(flightId) {
  const flight = await Flight.findById(flightId);
  if (!flight) throw new AppError(404, 'FLIGHT_NOT_FOUND', 'No stored flight matches this identifier.');
  return flight;
}

export async function refreshFlight(flight, config) {
  const results = await searchFlights({ flightNumber: flight.flightNumber, limit: 20 }, config);
  const refreshed = results.find(item =>
    item.flightNumber === flight.flightNumber &&
    (!flight.scheduledDeparture || item.scheduledDeparture?.getTime() === flight.scheduledDeparture.getTime())
  );
  if (!refreshed) throw new AppError(404, 'FLIGHT_NOT_FOUND', 'The configured provider did not return this flight.');
  return refreshed;
}

async function requestWithRetry(url, params) {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const { data } = await client.get(url, { params });
      if (data?.error) {
        throw new AppError(502, 'FLIGHT_PROVIDER_ERROR', 'The flight-data provider rejected the request.', {
          providerCode: String(data.error.code || 'PROVIDER_ERROR')
        });
      }
      return data;
    } catch (error) {
      const providerCode = error.response?.data?.error?.code;
      if (providerCode === 'function_access_restricted' && params.flight_date) {
        throw new AppError(
          502,
          'FLIGHT_PROVIDER_DATE_FILTER_RESTRICTED',
          'AviationStack rejected the flight-date search. The configured plan may not include scheduled or historical date filtering.',
          { providerCode, restrictedFilter: 'flight_date' }
        );
      }
      const retryable = axios.isAxiosError(error) && (!error.response || error.response.status === 429 || error.response.status >= 500);
      if (!retryable || attempt === 2) {
        if (error instanceof AppError) throw error;
        throw new AppError(502, 'FLIGHT_PROVIDER_UNAVAILABLE', 'The configured flight-data provider could not complete the request.');
      }
      await new Promise(resolve => setTimeout(resolve, 200 * (2 ** attempt)));
    }
  }
  throw new AppError(502, 'FLIGHT_PROVIDER_UNAVAILABLE', 'The configured flight-data provider could not complete the request.');
}

function normalizeAviationStack(record) {
  const flightNumber = record?.flight?.iata;
  const providerId = record?.flight?.number && record?.flight_date
    ? `${record.flight.iata || record.flight.number}:${record.flight_date}:${record.departure?.iata || ''}:${record.arrival?.iata || ''}`
    : undefined;
  if (!flightNumber || !providerId) {
    throw new AppError(502, 'FLIGHT_PROVIDER_INVALID_RESPONSE', 'The provider response is missing a flight number or stable flight identifier.');
  }
  return {
    providerId,
    provider: 'aviationstack',
    flightNumber: String(flightNumber).toUpperCase(),
    airline: record.airline?.name || undefined,
    origin: record.departure?.iata || undefined,
    destination: record.arrival?.iata || undefined,
    scheduledDeparture: parseDate(record.departure?.scheduled),
    scheduledArrival: parseDate(record.arrival?.scheduled),
    actualDeparture: parseDate(record.departure?.actual),
    actualArrival: parseDate(record.arrival?.actual),
    status: record.flight_status || undefined
  };
}

async function persistFlight(flight) {
  if (!flight.scheduledDeparture && !flight.scheduledArrival) return null;
  if (!flight.origin || !flight.destination) return null;
  const delayMinutes = flight.scheduledArrival && flight.actualArrival
    ? Math.max(0, Math.round((flight.actualArrival - flight.scheduledArrival) / 60000))
    : undefined;
  const saved = await Flight.findOneAndUpdate(
    { provider: flight.provider, providerId: flight.providerId },
    { $set: { ...flight, delayMinutes, lastFetchedAt: new Date() } },
    { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true }
  );
  if (saved.scheduledArrival) {
    await FlightSourceRecord.create({
      flightId: saved._id,
      sourceId: saved.provider,
      eventType: 'ARRIVAL',
      scheduledTime: saved.scheduledArrival,
      actualTime: saved.actualArrival,
      delayMinutes,
      fetchedAt: new Date(),
      status: 'RECEIVED'
    });
  }
  return saved;
}

function parseDate(value) {
  if (typeof value !== 'string') return undefined;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? undefined : date;
}
