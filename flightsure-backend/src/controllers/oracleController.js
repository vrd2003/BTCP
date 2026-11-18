import Flight from '../models/Flight.js';
import FlightSourceRecord from '../models/FlightSourceRecord.js';
import Verification from '../models/Verification.js';
import { collectVerification } from '../services/oracleService.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/respond.js';

async function findFlight(flightId) {
  const flight = await Flight.findById(flightId);
  if (!flight) throw new AppError(404, 'FLIGHT_NOT_FOUND', 'No stored flight matches this identifier.');
  return flight;
}

export async function verifyFlight(request, response) {
  const verification = await collectVerification(
    request.params.flightId, request.user, request.id, request.app.locals.config
  );
  const message = verification.consensusStatus === 'VERIFIED'
    ? 'Independent source consensus recorded. No blockchain transaction was submitted.'
    : 'Verification pending; eligible independent sources did not establish consensus.';
  return sendSuccess(response, verification.consensusStatus === 'VERIFIED' ? 200 : 202, message, { verification });
}

export async function getStatus(request, response) {
  await findFlight(request.params.flightId);
  const verification = await Verification.findOne({ flightId: request.params.flightId }).sort({ createdAt: -1 });
  return sendSuccess(response, 200, 'Latest verification state.', {
    verification: verification || null,
    status: verification?.consensusStatus || 'NOT_VERIFIED'
  });
}

export async function getSources(request, response) {
  await findFlight(request.params.flightId);
  const records = await FlightSourceRecord.find({ flightId: request.params.flightId })
    .where('sourceId').in(['SOURCE_A', 'SOURCE_B', 'SOURCE_C'])
    .sort({ fetchedAt: -1 }).limit(100).lean();
  return sendSuccess(response, 200, 'Recorded source observations.', { records });
}

export async function getHistory(request, response) {
  await findFlight(request.params.flightId);
  const verifications = await Verification.find({ flightId: request.params.flightId })
    .sort({ createdAt: -1 }).limit(100).lean();
  return sendSuccess(response, 200, 'Verification audit history.', { verifications });
}
