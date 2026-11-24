import { Router } from 'express';
import {
  createInvoice,
  listInvoices,
  listMyBookings,
  listTours,
  payInvoice,
  reserveBed,
  scheduleTour,
  updateTourStatus,
} from '../controllers/bookingController.ts';
import { optionalAuth, requireAuth, requireRole } from '../middleware/authMiddleware.ts';
import { asyncHandler } from '../utils/asyncHandler.ts';

const router = Router();

router.post('/tours', optionalAuth, asyncHandler(scheduleTour));
router.get('/tours', requireAuth, requireRole('admin'), asyncHandler(listTours));
router.patch('/tours/:id', requireAuth, requireRole('admin'), asyncHandler(updateTourStatus));
router.post('/reserve', requireAuth, asyncHandler(reserveBed));
router.get('/my', requireAuth, asyncHandler(listMyBookings));
router.get('/invoices', requireAuth, asyncHandler(listInvoices));
router.post('/invoices', requireAuth, requireRole('admin'), asyncHandler(createInvoice));
router.post('/invoices/:id/pay', requireAuth, asyncHandler(payInvoice));

export default router;
