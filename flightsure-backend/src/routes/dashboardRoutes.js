import { Router } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { asyncHandler } from '../utils/errors.js';
import { overview } from '../controllers/dashboardController.js';

export default function dashboardRoutes(config) {
  const router = Router();
  router.get('/overview', requireAuth(config), asyncHandler(overview));
  return router;
}
