import { Router, type NextFunction, type Request, type Response } from 'express';
import mongoose from 'mongoose';
import { connectDB, getLastDbError } from '../config/db.ts';
import aiRoutes from './aiRoutes.ts';
import adminRoutes from './adminRoutes.ts';
import authRoutes from './authRoutes.ts';
import bookingRoutes from './bookingRoutes.ts';
import propertyRoutes from './propertyRoutes.ts';
import residentRoutes from './residentRoutes.ts';
import roomRoutes from './roomRoutes.ts';
import ticketRoutes from './ticketRoutes.ts';

const router = Router();

router.get('/health', async (_req: Request, res: Response) => {
  let dbStatus = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  if (dbStatus === 'disconnected' && process.env.MONGODB_URI) {
    try {
      await connectDB();
      dbStatus = 'connected';
    } catch {
      dbStatus = 'unreachable';
    }
  }

  res.json({
    status: 'ok',
    database: dbStatus,
    dbMessage: dbStatus === 'connected' ? null : getLastDbError(),
    geminiConfigured: Boolean(process.env.GEMINI_API_KEY),
    timestamp: new Date().toISOString(),
  });
});

// Ensure MongoDB connection is active before hitting DB-backed routes
router.use(async (_req: Request, res: Response, next: NextFunction) => {
  if (mongoose.connection.readyState === 1) {
    next();
    return;
  }

  if (!process.env.MONGODB_URI) {
    res.status(503).json({
      error: 'Database is not configured. Please set MONGODB_URI in environment settings.',
    });
    return;
  }

  try {
    await connectDB();
    next();
  } catch (err) {
    const msg =
      err instanceof Error
        ? err.message
        : 'Database connection unavailable. Please verify MONGODB_URI.';
    res.status(503).json({ error: msg });
  }
});

router.use('/auth', authRoutes);
router.use('/admin', adminRoutes);
router.use('/properties', propertyRoutes);
router.use('/rooms', roomRoutes);
router.use('/bookings', bookingRoutes);
router.use('/tickets', ticketRoutes);
router.use('/residents', residentRoutes);
router.use('/ai', aiRoutes);

// Centralized API error handler
router.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  if (
    typeof err === 'object' &&
    err !== null &&
    'code' in err &&
    (err as { code?: number }).code === 11000
  ) {
    res.status(409).json({ error: 'A record with this unique identifier already exists.' });
    return;
  }

  if (err instanceof mongoose.Error.ValidationError) {
    res.status(400).json({ error: err.message });
    return;
  }

  console.error('[API Error]', err);
  res.status(500).json({
    error: 'An unexpected server error occurred.',
  });
});

export default router;
