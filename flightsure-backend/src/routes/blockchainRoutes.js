import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { policyIdParamsSchema, transactionHashParamsSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/errors.js';
import {
  createPolicyOnChain, getPolicyOnChain, getTransaction, listTransactions,
  processPayoutOnChain, submitVerificationOnChain
} from '../controllers/blockchainController.js';

export default function blockchainRoutes(config) {
  const router = Router();
  const authenticate = requireAuth(config);
  router.post('/create-policy', authenticate, asyncHandler(createPolicyOnChain));
  router.post('/submit-verification', authenticate, asyncHandler(submitVerificationOnChain));
  router.post('/process-payout', authenticate, asyncHandler(processPayoutOnChain));
  router.get('/transactions', authenticate, asyncHandler(listTransactions));
  router.get('/transaction/:txHash', authenticate, validate(transactionHashParamsSchema, 'params'), asyncHandler(getTransaction));
  router.get('/policy/:policyId', authenticate, validate(policyIdParamsSchema, 'params'), asyncHandler(getPolicyOnChain));
  return router;
}
