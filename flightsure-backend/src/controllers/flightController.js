import mongoose from 'mongoose';
import FlightSourceRecord from '../models/FlightSourceRecord.js';
import Flight from '../models/Flight.js';
import { getFlightById, searchFlights } from '../services/flightProvider.js';
import { getAirportWeather } from '../services/weatherProvider.js';
import { sendSuccess } from '../utils/respond.js';

export async function recent(request, response) {
  const flights = await Flight.find({ scheduledDeparture: mongoose.trusted({ $ne: null }) })
    .sort({ lastFetchedAt: -1 })
    .limit(request.validatedQuery.limit)
    .lean();
  return sendSuccess(response, 200, 'Recently updated provider flights.', { flights });
}

export async function search(request, response) {
  const flights = await searchFlights(request.validatedQuery, request.app.locals.config);
  return sendSuccess(response, 200, 'Flight search completed.', { flights });
}

export async function getById(request, response) {
  const flight = await getFlightById(request.params.flightId);
  return sendSuccess(response, 200, 'Flight details.', { flight });
}

export async function status(request, response) {
  const flight = await getFlightById(request.params.flightId);
  return sendSuccess(response, 200, 'Latest flight status from the configured provider.', {
    flightId: flight.id,
    status: flight.status || null,
    scheduledDeparture: flight.scheduledDeparture || null,
    scheduledArrival: flight.scheduledArrival || null,
    actualDeparture: flight.actualDeparture || null,
    actualArrival: flight.actualArrival || null,
    delayMinutes: flight.delayMinutes ?? null,
    lastFetchedAt: flight.lastFetchedAt || null,
    provider: flight.provider
  });
}

export async function weather(request, response) {
  const flight = await getFlightById(request.params.flightId);
  const conditions = await getAirportWeather(flight, request.app.locals.config);
  return sendSuccess(response, 200, 'Current airport conditions from OpenWeather; not a flight-time forecast.', {
    weather: conditions
  });
}

export async function history(request, response) {
  await getFlightById(request.params.flightId);
  const records = await FlightSourceRecord.find({ flightId: request.params.flightId })
    .sort({ fetchedAt: -1 }).limit(100).lean();
  return sendSuccess(response, 200, 'Provider observations.', { records });
}
