import Policy from '../models/Policy.js';
import Flight from '../models/Flight.js';
import Verification from '../models/Verification.js';
import Compensation from '../models/Compensation.js';
import Notification from '../models/Notification.js';
import { sendSuccess } from '../utils/respond.js';

export async function overview(request, response) {
  const policies = await Policy.find({ userId: request.user._id }).select('_id flightId status');
  const policyIds = policies.map(policy => policy._id);
  const flightIds = [...new Set(policies.map(policy => policy.flightId.toString()))];
  const [flights, compensation, pendingVerification, notifications] = await Promise.all([
    flightIds.length ? Flight.find({ _id: { $in: flightIds } }).sort({ scheduledDeparture: 1 }) : [],
    Compensation.aggregate([
      { $match: { policyId: { $in: policyIds }, payoutStatus: 'CONFIRMED' } },
      { $group: { _id: '$currency', totalMinor: { $sum: '$compensationAmountMinor' }, count: { $sum: 1 } } }
    ]),
    flightIds.length ? Verification.countDocuments({ flightId: { $in: flightIds }, consensusStatus: 'VERIFICATION_PENDING' }) : 0,
    Notification.find({ userId: request.user._id }).sort({ createdAt: -1 }).limit(10)
  ]);
  return sendSuccess(response, 200, 'Dashboard data.', {
    metrics: {
      activePolicies: policies.filter(policy => policy.status === 'ACTIVE').length,
      monitoredFlights: flights.length,
      confirmedCompensation: compensation,
      pendingVerification
    },
    policies,
    flights,
    recentActivity: notifications,
    delayHistory: []
  });
}
