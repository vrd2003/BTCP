import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { compensationCalculateSchema, policyIdParamsSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/errors.js';
import { calculate, getPolicyCompensation, history, process } from '../controllers/compensationController.js';

export default function compensationRoutes(config) {
  const router = Router();
  const authenticate = requireAuth(config);
  router.post('/calculate', authenticate, validate(compensationCalculateSchema), asyncHandler(calculate));
  router.post('/process', authenticate, validate(compensationCalculateSchema), asyncHandler(process));
  router.get('/history', authenticate, asyncHandler(history));
  router.get('/:policyId', authenticate, validate(policyIdParamsSchema, 'params'), asyncHandler(getPolicyCompensation));
  return router;
}
