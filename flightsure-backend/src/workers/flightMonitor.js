import cron from 'node-cron';
import { randomUUID } from 'node:crypto';
import mongoose from 'mongoose';
import Policy from '../models/Policy.js';
import SystemState from '../models/SystemState.js';
import User from '../models/User.js';
import Notification from '../models/Notification.js';
import { refreshFlight } from '../services/flightProvider.js';
import { collectVerification } from '../services/oracleService.js';
import { publishUserNotification } from '../sockets/index.js';

export function startFlightMonitor(io, config) {
  if (!config.FLIGHT_PROVIDER_API_KEY || !config.FLIGHT_PROVIDER_URL) {
    console.log(JSON.stringify({ level: 'info', event: 'flight_monitor_disabled', reason: 'flight_provider_not_configured' }));
    return { stop() {} };
  }
  if (!cron.validate(config.MONITOR_POLL_CRON)) {
    throw new Error('MONITOR_POLL_CRON is not a valid cron expression.');
  }
  const task = cron.schedule(config.MONITOR_POLL_CRON, async () => {
    try {
      const state = await SystemState.findOne({ key: 'monitoring' }).lean();
      if (state?.value?.paused) return;
      const now = new Date();
      const candidates = await Policy.find(monitoringPolicyFilter(now)).limit(100).populate('flightId');
      await Promise.all(candidates.map(policy => monitorPolicy(policy, io, config)));
    } catch (error) {
      console.error(JSON.stringify({ level: 'error', event: 'flight_monitor_failed', message: error.message }));
    }
  }, { timezone: 'UTC' });
  return task;
}

async function monitorPolicy(policy, io, config) {
  const now = new Date();
  const claimed = await Policy.findOneAndUpdate(
    { _id: policy._id, ...monitoringPolicyFilter(now) },
    { $set: { monitoringLeaseUntil: new Date(now.getTime() + 2 * 60 * 1000) } },
    { new: true }
  );
  if (!claimed || !policy.flightId) return;
  try {
    const previousStatus = policy.flightId.status;
    const previousArrival = policy.flightId.actualArrival?.getTime();
    const flight = await refreshFlight(policy.flightId, config);
    if (flight.status !== previousStatus || flight.actualArrival?.getTime() !== previousArrival) {
      await notify(io, claimed.userId, 'FLIGHT_STATUS_CHANGED', 'Flight status updated', `${flight.flightNumber} status was updated by the configured flight-data provider.`);
    }
    if (flight.actualArrival && !previousArrival) {
      const admin = config.ADMIN_BOOTSTRAP_EMAIL
        ? await User.findOne({ email: config.ADMIN_BOOTSTRAP_EMAIL.toLowerCase(), role: 'Admin' })
        : null;
      if (admin) {
        const verification = await collectVerification(flight.id, admin, randomUUID(), config);
        const title = verification.consensusStatus === 'VERIFIED' ? 'Flight event verified' : 'Verification pending';
        const message = verification.consensusStatus === 'VERIFIED'
          ? 'Independent flight sources agree. Policy terms will be checked separately.'
          : 'Independent source consensus is not available yet. No payout was authorized.';
        await notify(io, claimed.userId, verification.consensusStatus, title, message);
      }
    }
  } catch (error) {
    console.error(JSON.stringify({
      level: 'error',
      event: 'flight_monitor_policy_failed',
      policyId: claimed.policyId,
      message: error.message
    }));
  } finally {
    await Policy.updateOne({ _id: claimed._id }, { $unset: { monitoringLeaseUntil: 1 } });
  }
}

export function monitoringPolicyFilter(now) {
  return {
    status: 'ACTIVE',
    $or: [
      { monitoringLeaseUntil: null },
      { monitoringLeaseUntil: mongoose.trusted({ $lt: now }) }
    ]
  };
}

async function notify(io, userId, type, title, message) {
  const notification = await Notification.create({ userId, type, title, message });
  await publishUserNotification(io, notification);
}
