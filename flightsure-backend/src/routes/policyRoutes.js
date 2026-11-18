import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { policyConfirmSchema, policyCreateSchema, policyIdParamsSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/errors.js';
import {
  confirmPolicy, createPolicy, getPolicy, getPolicyStatus, listCatalog, listPolicies, policiesForUser
} from '../controllers/policyController.js';

export default function policyRoutes(config) {
  const router = Router();
  const authenticate = requireAuth(config);
  router.get('/catalog', authenticate, asyncHandler(listCatalog));
  router.post('/', authenticate, validate(policyCreateSchema), asyncHandler(createPolicy));
  router.post('/confirm', authenticate, validate(policyConfirmSchema), asyncHandler(confirmPolicy));
  router.get('/', authenticate, asyncHandler(listPolicies));
  router.get('/user/:userId', authenticate, asyncHandler(policiesForUser));
  router.get('/:policyId/status', authenticate, validate(policyIdParamsSchema, 'params'), asyncHandler(getPolicyStatus));
  router.get('/:policyId', authenticate, validate(policyIdParamsSchema, 'params'), asyncHandler(getPolicy));
  return router;
}
