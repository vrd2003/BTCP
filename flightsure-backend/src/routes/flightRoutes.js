import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { flightSearchSchema, flightIdParamsSchema, recentFlightsSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/errors.js';
import { getById, history, recent, search, status, weather } from '../controllers/flightController.js';

export default function flightRoutes(config) {
  const router = Router();
  const authenticate = requireAuth(config);
  router.get('/recent', authenticate, validate(recentFlightsSchema, 'query'), asyncHandler(recent));
  router.get('/search', authenticate, validate(flightSearchSchema, 'query'), asyncHandler(search));
  router.get('/:flightId/weather', authenticate, validate(flightIdParamsSchema, 'params'), asyncHandler(weather));
  router.get('/:flightId/status', authenticate, validate(flightIdParamsSchema, 'params'), asyncHandler(status));
  router.get('/:flightId/history', authenticate, validate(flightIdParamsSchema, 'params'), asyncHandler(history));
  router.get('/:flightId', authenticate, validate(flightIdParamsSchema, 'params'), asyncHandler(getById));
  return router;
}
