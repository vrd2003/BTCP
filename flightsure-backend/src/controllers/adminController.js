import User from '../models/User.js';
import Flight from '../models/Flight.js';
import Policy from '../models/Policy.js';
import Verification from '../models/Verification.js';
import Compensation from '../models/Compensation.js';
import Transaction from '../models/Transaction.js';
import AuditLog from '../models/AuditLog.js';
import SystemState from '../models/SystemState.js';
import { AppError } from '../utils/errors.js';
import { sendSuccess } from '../utils/respond.js';
import { getInsurancePool, isBlockchainConfigured } from '../services/blockchainService.js';

export async function dashboard(request, response) {
  const [users, policies, flights, pendingCases, confirmedPayouts, state] = await Promise.all([
    User.countDocuments(),
    Policy.countDocuments({ status: 'ACTIVE' }),
    Flight.countDocuments(),
    Verification.countDocuments({ consensusStatus: 'VERIFICATION_PENDING' }),
    Compensation.aggregate([
      { $match: { payoutStatus: 'CONFIRMED' } },
      { $group: { _id: '$currency', totalMinor: { $sum: '$compensationAmountMinor' }, count: { $sum: 1 } } }
    ]),
    SystemState.findOne({ key: 'monitoring' }).lean()
  ]);
  const config = request.app.locals.config;
  const insurancePool = await readInsurancePool(config);
  return sendSuccess(response, 200, 'Administrative overview.', {
    users,
    activePolicies: policies,
    monitoredFlights: flights,
    pendingCases,
    confirmedPayouts,
    monitoringPaused: state?.value?.paused === true,
    integrations: {
      flightProvider: Boolean(config.FLIGHT_PROVIDER_API_KEY && config.FLIGHT_PROVIDER_URL),
      weatherProvider: Boolean(config.OPENWEATHER_API_KEY),
      groqAi: Boolean(config.GROQ_API_KEY),
      policyCatalog: config.POLICY_CATALOG.length > 0,
      independentOracleSources: Boolean(
        config.ORACLE_SOURCE_A_URL && config.ORACLE_SOURCE_A_KEY && config.ORACLE_SOURCE_A_FEED_ID &&
        config.ORACLE_SOURCE_B_URL && config.ORACLE_SOURCE_B_KEY && config.ORACLE_SOURCE_B_FEED_ID &&
        config.ORACLE_SOURCE_C_URL && config.ORACLE_SOURCE_C_KEY && config.ORACLE_SOURCE_C_FEED_ID
      ),
      blockchain: isBlockchainConfigured(config)
    },
    insurancePool
  });
}

export async function listUsers(request, response) {
  const { page, limit } = parsePagination(request.query);
  const [users, total] = await Promise.all([
    User.find().select('name email role walletAddress createdAt').sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    User.countDocuments()
  ]);
  return sendSuccess(response, 200, 'User directory.', { users, page, limit, total });
}

export async function listFlights(request, response) {
  const { page, limit } = parsePagination(request.query);
  const [flights, total] = await Promise.all([
    Flight.find().sort({ scheduledDeparture: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Flight.countDocuments()
  ]);
  return sendSuccess(response, 200, 'Stored provider flights.', { flights, page, limit, total });
}

export async function listPolicies(request, response) {
  const { page, limit } = parsePagination(request.query);
  const [policies, total] = await Promise.all([
    Policy.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).populate('flightId', 'flightNumber origin destination').lean(),
    Policy.countDocuments()
  ]);
  return sendSuccess(response, 200, 'Policy registry.', { policies, page, limit, total });
}

export async function listTransactions(request, response) {
  const { page, limit } = parsePagination(request.query);
  const [transactions, total] = await Promise.all([
    Transaction.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    Transaction.countDocuments()
  ]);
  return sendSuccess(response, 200, 'Blockchain transaction records.', { transactions, page, limit, total });
}

export async function listAuditLogs(request, response) {
  const { page, limit } = parsePagination(request.query);
  const [entries, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments()
  ]);
  return sendSuccess(response, 200, 'Administrative audit records.', { entries, page, limit, total });
}

export async function pauseMonitoring(request, response) {
  const state = await SystemState.findOneAndUpdate(
    { key: 'monitoring' },
    { $set: { value: { paused: true, reason: request.body.reason, changedAt: new Date() }, updatedBy: request.user._id } },
    { new: true, upsert: true, runValidators: true }
  );
  await AuditLog.create({
    actorId: request.user._id, action: 'MONITORING_PAUSE', resourceType: 'SystemState',
    resourceId: state.id, requestId: request.id, outcome: 'SUCCESS',
    metadata: { reason: request.body.reason }
  });
  return sendSuccess(response, 200, 'Flight monitoring paused.', { paused: true, reason: request.body.reason });
}

export async function resumeMonitoring(request, response) {
  const state = await SystemState.findOneAndUpdate(
    { key: 'monitoring' },
    { $set: { value: { paused: false, changedAt: new Date() }, updatedBy: request.user._id } },
    { new: true, upsert: true, runValidators: true }
  );
  await AuditLog.create({
    actorId: request.user._id, action: 'MONITORING_RESUME', resourceType: 'SystemState',
    resourceId: state.id, requestId: request.id, outcome: 'SUCCESS'
  });
  return sendSuccess(response, 200, 'Flight monitoring resumed.', { paused: false });
}

export async function insurancePool(request, response) {
  const result = await readInsurancePool(request.app.locals.config);
  return sendSuccess(response, 200, 'Insurance pool state.', result);
}

async function readInsurancePool(config) {
  if (!isBlockchainConfigured(config)) {
    return { available: false, reason: 'Sepolia contract and RPC are not configured.' };
  }
  return { available: true, balanceWei: await getInsurancePool(config), currency: 'ETH', network: 'sepolia' };
}

function parsePagination(query) {
  const page = Number.parseInt(query.page || '1', 10);
  const limit = Number.parseInt(query.limit || '25', 10);
  if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > 100) {
    throw new AppError(400, 'INVALID_PAGINATION', 'Page must be positive and limit must be between 1 and 100.');
  }
  return { page, limit };
}
