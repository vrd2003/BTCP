import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { z } from 'zod';
import { asyncHandler } from '../utils/errors.js';
import {
  dashboard, insurancePool, listAuditLogs, listFlights, listPolicies, listTransactions,
  listUsers, pauseMonitoring, resumeMonitoring
} from '../controllers/adminController.js';

const reasonSchema = z.object({ reason: z.string().trim().min(8).max(500) }).strict();

export default function adminRoutes(config) {
  const router = Router();
  router.use(requireAuth(config), requireRole('Admin'));
  router.get('/dashboard', asyncHandler(dashboard));
  router.get('/users', asyncHandler(listUsers));
  router.get('/flights', asyncHandler(listFlights));
  router.get('/policies', asyncHandler(listPolicies));
  router.get('/transactions', asyncHandler(listTransactions));
  router.get('/audit', asyncHandler(listAuditLogs));
  router.get('/insurance-pool', asyncHandler(insurancePool));
  router.post('/monitoring/pause', validate(reasonSchema), asyncHandler(pauseMonitoring));
  router.post('/monitoring/resume', asyncHandler(resumeMonitoring));
  return router;
}
