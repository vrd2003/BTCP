import axios from 'axios';
import { z } from 'zod';
import Flight from '../models/Flight.js';
import FlightSourceRecord from '../models/FlightSourceRecord.js';
import Verification from '../models/Verification.js';
import AuditLog from '../models/AuditLog.js';
import { consensusFor } from '../oracle/consensus.js';
import { AppError } from '../utils/errors.js';

const sourceSchema = z.object({
  flightNumber: z.string().min(2).max(12),
  eventType: z.literal('ARRIVAL'),
  scheduledTime: z.iso.datetime({ offset: true }),
  actualTime: z.iso.datetime({ offset: true }),
  fetchedAt: z.iso.datetime({ offset: true })
}).strict();

export async function collectVerification(flightId, actor, requestId, config) {
  const flight = await Flight.findById(flightId);
  if (!flight) throw new AppError(404, 'FLIGHT_NOT_FOUND', 'No stored flight matches this identifier.');
  if (!flight.scheduledArrival || Number.isNaN(flight.scheduledArrival.getTime())) {
    throw new AppError(409, 'SCHEDULED_ARRIVAL_UNAVAILABLE', 'A scheduled arrival is required before oracle verification can run.');
  }

  const providers = [
    { sourceId: 'SOURCE_A', url: config.ORACLE_SOURCE_A_URL, key: config.ORACLE_SOURCE_A_KEY, feedId: config.ORACLE_SOURCE_A_FEED_ID },
    { sourceId: 'SOURCE_B', url: config.ORACLE_SOURCE_B_URL, key: config.ORACLE_SOURCE_B_KEY, feedId: config.ORACLE_SOURCE_B_FEED_ID },
    { sourceId: 'SOURCE_C', url: config.ORACLE_SOURCE_C_URL, key: config.ORACLE_SOURCE_C_KEY, feedId: config.ORACLE_SOURCE_C_FEED_ID }
  ];
  const configured = providers.filter(provider => provider.url && provider.key && provider.feedId);
  const distinctHosts = new Set(configured.map(provider => new URL(provider.url).host));
  const distinctFeeds = new Set(configured.map(provider => provider.feedId));
  const canVerify = configured.length === 3 && distinctHosts.size === 3 && distinctFeeds.size === 3;
  const records = canVerify
    ? await Promise.all(providers.map(provider => fetchSource(provider, flight, config.ORACLE_MAX_AGE_SECONDS)))
    : providers.map(provider => ({
      sourceId: provider.sourceId,
      eventType: 'ARRIVAL',
      scheduledTime: flight.scheduledArrival,
      fetchedAt: new Date(),
      status: 'UNAVAILABLE',
      errorCode: !provider.url || !provider.key
        ? 'SOURCE_NOT_CONFIGURED'
        : 'SOURCE_INDEPENDENCE_NOT_ESTABLISHED'
    }));

  await FlightSourceRecord.insertMany(records.map(record => ({
    flightId: flight._id,
    ...record
  })));
  const consensus = canVerify
    ? consensusFor(records, config.ORACLE_DELAY_TOLERANCE_MINUTES)
    : { status: 'VERIFICATION_PENDING', agreeingSourceIds: [], delayMinutes: undefined };
  const eventId = consensus.status === 'VERIFIED'
    ? `${flight.id}:ARRIVAL:${flight.scheduledArrival?.toISOString()}:${consensus.delayMinutes}`
    : undefined;
  if (eventId) {
    const existing = await Verification.findOne({ eventId });
    if (existing) return existing;
  }

  let verification;
  try {
    verification = await Verification.create({
      flightId: flight._id,
      sourceRecords: records,
      consensusStatus: consensus.status,
      status: consensus.status,
      verifiedDelayMinutes: consensus.delayMinutes,
      agreeingSourceIds: consensus.agreeingSourceIds,
      eventId
    });
  } catch (error) {
    if (error.code !== 11000 || !eventId) throw error;
    verification = await Verification.findOne({ eventId });
    if (!verification) throw error;
  }
  await AuditLog.create({
    actorId: actor._id,
    action: 'ORACLE_VERIFY',
    resourceType: 'Flight',
    resourceId: flight.id,
    requestId,
    outcome: consensus.status === 'VERIFIED' ? 'SUCCESS' : 'DENIED',
    metadata: {
      consensusStatus: consensus.status,
      agreeingSourceIds: consensus.agreeingSourceIds,
      sourcesConfigured: configured.length,
      sourceHostsIndependent: distinctHosts.size === 3,
      sourceFeedsIndependent: distinctFeeds.size === 3
    }
  });
  return verification;
}

async function fetchSource(provider, flight, maxAgeSeconds) {
  try {
    const response = await axios.get(provider.url, {
      timeout: 6000,
      maxRedirects: 0,
      headers: { Authorization: `Bearer ${provider.key}` },
      params: { flightNumber: flight.flightNumber, scheduledArrival: flight.scheduledArrival?.toISOString() }
    });
    const parsed = sourceSchema.safeParse(response.data);
    if (!parsed.success) {
      return {
        sourceId: provider.sourceId,
        eventType: 'ARRIVAL',
        scheduledTime: flight.scheduledArrival,
        fetchedAt: new Date(),
        status: 'INVALID',
        errorCode: 'INVALID_SOURCE_RESPONSE'
      };
    }
    const report = parsed.data;
    const fetchedAt = new Date(report.fetchedAt);
    const scheduledTime = new Date(report.scheduledTime);
    const actualTime = new Date(report.actualTime);
    const now = Date.now();
    const flightMatches = report.flightNumber.replace(/\s+/g, '').toUpperCase() === flight.flightNumber.replace(/\s+/g, '').toUpperCase();
    const scheduledMatches = flight.scheduledArrival && Math.abs(scheduledTime - flight.scheduledArrival) <= 5 * 60 * 1000;
    const notFuture = fetchedAt.getTime() <= now + 30_000 &&
      actualTime.getTime() <= now + 30_000 &&
      actualTime.getTime() <= fetchedAt.getTime() + 30_000;
    const fresh = now - fetchedAt.getTime() <= maxAgeSeconds * 1000;
    if (!flightMatches || !scheduledMatches || !notFuture) {
      return { sourceId: provider.sourceId, eventType: 'ARRIVAL', scheduledTime, actualTime, fetchedAt, status: 'INVALID', errorCode: 'FLIGHT_OR_TIMESTAMP_MISMATCH' };
    }
    if (!fresh) {
      return { sourceId: provider.sourceId, eventType: 'ARRIVAL', scheduledTime, actualTime, fetchedAt, status: 'STALE', errorCode: 'STALE_SOURCE_REPORT' };
    }
    return {
      sourceId: provider.sourceId,
      eventType: 'ARRIVAL',
      scheduledTime,
      actualTime,
      delayMinutes: Math.max(0, Math.round((actualTime - scheduledTime) / 60_000)),
      fetchedAt,
      status: 'RECEIVED'
    };
  } catch (error) {
    const status = axios.isAxiosError(error) ? 'UNAVAILABLE' : 'INVALID';
    return {
      sourceId: provider.sourceId,
      eventType: 'ARRIVAL',
      scheduledTime: flight.scheduledArrival,
      fetchedAt: new Date(),
      status,
      errorCode: 'SOURCE_REQUEST_FAILED'
    };
  }
}
