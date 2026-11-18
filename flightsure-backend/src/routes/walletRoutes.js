import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { createWalletNonce, verifyWallet } from '../controllers/authController.js';
import { walletNonceSchema, walletVerifySchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/errors.js';

export default function walletRoutes(config) {
  const router = Router();
  const authenticate = requireAuth(config);
  router.post('/nonce', authenticate, validate(walletNonceSchema), asyncHandler(createWalletNonce));
  router.post('/verify', authenticate, validate(walletVerifySchema), asyncHandler(verifyWallet));
  return router;
}
