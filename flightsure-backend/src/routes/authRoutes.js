import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import {
  login, logout, me, register
} from '../controllers/authController.js';
import { loginSchema, registerSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/errors.js';

const authRateLimit = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 30,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { success: false, error: { code: 'RATE_LIMITED', message: 'Too many authentication attempts.' } }
});

export default function authRoutes(config) {
  const router = Router();
  const authenticate = requireAuth(config);
  router.post('/register', authRateLimit, validate(registerSchema), asyncHandler(register));
  router.post('/login', authRateLimit, validate(loginSchema), asyncHandler(login));
  router.post('/logout', authenticate, asyncHandler(logout));
  router.get('/me', authenticate, asyncHandler(me));
  return router;
}
