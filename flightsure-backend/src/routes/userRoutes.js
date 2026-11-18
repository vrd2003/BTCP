import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { validate } from '../middleware/validate.js';
import { updateProfile } from '../controllers/authController.js';
import { profileSchema } from '../validators/schemas.js';
import { asyncHandler } from '../utils/errors.js';

export default function userRoutes(config) {
  const router = Router();
  router.put('/profile', requireAuth(config), validate(profileSchema), asyncHandler(updateProfile));
  return router;
}
