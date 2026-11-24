import { Router } from 'express';
import {
  createTicket,
  listTickets,
  updateTicket,
} from '../controllers/ticketController.ts';
import { requireAuth, requireRole } from '../middleware/authMiddleware.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

const router = Router();

router.get('/', requireAuth, asyncHandler(listTickets));
router.post('/', requireAuth, requireRole('resident', 'admin'), asyncHandler(createTicket));
router.patch('/:id', requireAuth, requireRole('admin'), asyncHandler(updateTicket));

export default router;
