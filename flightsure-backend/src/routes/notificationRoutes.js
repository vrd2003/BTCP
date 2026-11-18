import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { objectIdParamsSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/errors.js';
import { listNotifications, markRead } from '../controllers/notificationController.js';

export default function notificationRoutes(config) {
  const router = Router();
  router.get('/', requireAuth(config), asyncHandler(listNotifications));
  router.patch('/:id/read', requireAuth(config), validate(objectIdParamsSchema, 'params'), asyncHandler(markRead));
  return router;
}
