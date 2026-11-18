import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { predictionRequestSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/errors.js';
import { history, predict } from '../controllers/predictionController.js';

export default function predictionRoutes(config) {
  const router = Router();
  router.post('/', requireAuth(config), validate(predictionRequestSchema), asyncHandler(predict));
  router.get('/history', requireAuth(config), asyncHandler(history));
  return router;
}
