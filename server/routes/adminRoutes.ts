import { Router } from 'express';
import {
  importRealDataHandler,
  resetSampleData,
} from '../controllers/adminController.ts';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

const router = Router();

router.delete('/sample-data', requireAuth, requireRole('admin'), asyncHandler(resetSampleData));
router.post('/import', requireAuth, requireRole('admin'), asyncHandler(importRealDataHandler));

export default router;
