import { Router } from 'express';
import {
  bootstrapAdmin,
  getMe,
  getSetupStatus,
  login,
  logout,
  register,
} from '../controllers/authController.ts';
import { requireAuth } from '../middleware/authMiddleware.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

const router = Router();

router.get('/setup-status', asyncHandler(getSetupStatus));
router.post('/bootstrap', asyncHandler(bootstrapAdmin));
router.post('/register', asyncHandler(register));
router.post('/login', asyncHandler(login));
router.post('/logout', asyncHandler(logout));
router.get('/me', requireAuth, asyncHandler(getMe));

export default router;
