import { Router } from 'express';
import {
  allocateBed,
  createRoom,
  deleteRoom,
  getBedMatrix,
  getRoomById,
  listRooms,
  updateRoom,
} from '../controllers/roomController.ts';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

const router = Router();

router.get('/', asyncHandler(listRooms));
router.get('/beds/matrix', requireAuth, requireRole('admin'), asyncHandler(getBedMatrix));
router.patch('/beds/:id/allocate', requireAuth, requireRole('admin'), asyncHandler(allocateBed));
router.get('/:id', asyncHandler(getRoomById));
router.post('/', requireAuth, requireRole('admin'), asyncHandler(createRoom));
router.patch('/:id', requireAuth, requireRole('admin'), asyncHandler(updateRoom));
router.delete('/:id', requireAuth, requireRole('admin'), asyncHandler(deleteRoom));

export default router;
