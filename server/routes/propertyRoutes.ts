import { Router } from 'express';
import {
  createProperty,
  getPrimaryProperty,
  listProperties,
  updateHouseRules,
  updateProperty,
  updateWeeklyMenu,
} from '../controllers/propertyController.ts';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

const router = Router();

router.get('/', asyncHandler(listProperties));
router.get('/primary', asyncHandler(getPrimaryProperty));
router.post('/', requireAuth, requireRole('admin'), asyncHandler(createProperty));
router.put('/:id', requireAuth, requireRole('admin'), asyncHandler(updateProperty));
router.put('/:id/menu', requireAuth, requireRole('admin'), asyncHandler(updateWeeklyMenu));
router.put('/:id/rules', requireAuth, requireRole('admin'), asyncHandler(updateHouseRules));

export default router;
