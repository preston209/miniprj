import { Router } from 'express';
import {
  getMyMealOptOuts,
  listResidents,
  onboardResident,
  toggleMealOptOut,
} from '../controllers/residentController.ts';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

const router = Router();

router.get('/', requireAuth, requireRole('admin'), asyncHandler(listResidents));
router.post('/onboard', requireAuth, requireRole('admin'), asyncHandler(onboardResident));
router.get(
  '/me/meal-opt-outs',
  requireAuth,
  requireRole('resident', 'admin'),
  asyncHandler(getMyMealOptOuts)
);
router.put(
  '/me/meal-opt-outs',
  requireAuth,
  requireRole('resident', 'admin'),
  asyncHandler(toggleMealOptOut)
);

export default router;
