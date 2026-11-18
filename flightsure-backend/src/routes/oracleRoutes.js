import { Router } from 'express';
import { requireAuth, requireRole } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { flightIdParamsSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/errors.js';
import { getHistory, getSources, getStatus, verifyFlight } from '../controllers/oracleController.js';

export default function oracleRoutes(config) {
  const router = Router();
  const admin = [requireAuth(config), requireRole('Admin')];
  router.post('/verify/:flightId', ...admin, validate(flightIdParamsSchema, 'params'), asyncHandler(verifyFlight));
  router.get('/status/:flightId', requireAuth(config), validate(flightIdParamsSchema, 'params'), asyncHandler(getStatus));
  router.get('/sources/:flightId', requireAuth(config), validate(flightIdParamsSchema, 'params'), asyncHandler(getSources));
  router.get('/history/:flightId', requireAuth(config), validate(flightIdParamsSchema, 'params'), asyncHandler(getHistory));
  return router;
}
