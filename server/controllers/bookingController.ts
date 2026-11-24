import crypto from 'crypto';
import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { Bed } from '../models/Bed.ts';
import { Booking } from '../models/Booking.ts';
import { Property } from '../models/Property.ts';
import { Room } from '../models/Room.ts';
import { User } from '../models/User.ts';

const scheduleTourSchema = z.object({
  propertyId: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), 'Invalid propertyId')
    .optional(),
  roomId: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), 'Invalid roomId')
    .optional(),
  tourMode: z.enum(['physical', 'virtual']),
  tourSlotDate: z.string().min(4).max(40),
  tourSlotTime: z.string().trim().min(2).max(30),
  leadName: z.string().trim().min(2).max(100),
  leadEmail: z.string().trim().toLowerCase().email(),
  leadPhone: z.string().trim().min(7).max(20),
  sharingPreference: z.enum(['single', 'double', 'triple']).optional(),
  moveInTimeline: z.string().trim().max(80).optional(),
  notes: z.string().trim().max(400).optional(),
});

const reserveBedSchema = z.object({
  roomId: z.string().refine((val) => Types.ObjectId.isValid(val), 'Invalid roomId'),
  bedId: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), 'Invalid bedId')
    .optional(),
  moveInDate: z.string().min(4).max(40),
  notes: z.string().trim().max(400).optional(),
});

const createInvoiceSchema = z.object({
  userId: z.string().refine((val) => Types.ObjectId.isValid(val), 'Invalid userId'),
  billingMonth: z.string().regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM format'),
  electricityUnits: z.number().min(0).max(5000).default(0),
  mealDeduction: z.number().min(0).max(10000).default(0),
  notes: z.string().trim().max(400).optional(),
});

const payInvoiceSchema = z.object({
  paymentGateway: z.enum(['razorpay_mock', 'stripe_mock', 'upi']),
});

const updateTourStatusSchema = z.object({
  status: z.enum(['pending', 'confirmed', 'completed', 'converted_to_resident', 'cancelled']),
  notes: z.string().trim().max(500).optional(),
});

export async function scheduleTour(req: AuthenticatedRequest, res: Response): Promise<void> {
  const parsed = scheduleTourSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid tour scheduling details.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const data = parsed.data;
  const property = data.propertyId
    ? await Property.findById(data.propertyId).select('_id').lean()
    : await Property.findOne({ isActive: true }).select('_id').lean();

  if (!property) {
    res.status(404).json({ error: 'Property not found.' });
    return;
  }

  const booking = await Booking.create({
    bookingType: 'tour',
    propertyId: property._id,
    roomId: data.roomId ? new Types.ObjectId(data.roomId) : null,
    userId: req.user?._id ?? null,
    tourMode: data.tourMode,
    tourSlotDate: new Date(data.tourSlotDate),
    tourSlotTime: data.tourSlotTime,
    leadName: data.leadName,
    leadEmail: data.leadEmail,
    leadPhone: data.leadPhone,
    sharingPreference: data.sharingPreference,
    moveInTimeline: data.moveInTimeline,
    notes: data.notes,
    status: 'confirmed',
  });

  res.status(201).json({
    message: 'Tour scheduled successfully.',
    booking,
  });
}

export async function listTours(_req: Request, res: Response): Promise<void> {
  const tours = await Booking.find({ bookingType: 'tour' })
    .populate('roomId', 'roomNumber sharingType isAC')
    .sort({ tourSlotDate: 1, createdAt: -1 })
    .lean();

  res.json({ tours });
}

export async function updateTourStatus(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid tour booking ID.' });
    return;
  }

  const parsed = updateTourStatusSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid tour status update payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const booking = await Booking.findOne({ _id: id, bookingType: 'tour' });
  if (!booking) {
    res.status(404).json({ error: 'Tour booking not found.' });
    return;
  }

  booking.status = parsed.data.status;
  if (parsed.data.notes !== undefined) {
    booking.notes = parsed.data.notes;
  }
  await booking.save();

  res.json({
    message: `Tour status updated to "${booking.status}".`,
    booking,
  });
}

export async function reserveBed(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Sign in required to reserve a bed.' });
    return;
  }

  const parsed = reserveBedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid reservation request.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { roomId, bedId, moveInDate, notes } = parsed.data;
  const room = await Room.findById(roomId);
  if (!room || !room.isActive) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  const bedQuery: Record<string, unknown> = {
    roomId: room._id,
    status: 'available',
  };
  if (bedId) {
    bedQuery._id = new Types.ObjectId(bedId);
  }

  const bed = await Bed.findOne(bedQuery);
  if (!bed) {
    res.status(409).json({ error: 'No available bed left in this room.' });
    return;
  }

  bed.status = 'reserved';
  bed.currentTenantId = req.user._id;
  await bed.save();

  const booking = await Booking.create({
    bookingType: 'reservation',
    propertyId: room.propertyId,
    roomId: room._id,
    bedId: bed._id,
    userId: req.user._id,
    leadName: req.user.name,
    leadEmail: req.user.email,
    leadPhone: req.user.phone,
    moveInDate: new Date(moveInDate),
    monthlyRent: room.monthlyRent,
    securityDeposit: room.securityDeposit,
    status: 'confirmed',
    notes,
  });

  res.status(201).json({
    message: `Bed ${bed.bedCode} reserved successfully.`,
    booking,
    bed,
  });
}

export async function listMyBookings(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const bookings = await Booking.find({ userId: req.user._id })
    .populate('propertyId', 'name address')
    .populate('roomId', 'roomNumber sharingType isAC')
    .populate('bedId', 'bedCode status')
    .sort({ createdAt: -1 })
    .lean();

  res.json({ bookings });
}

export async function listInvoices(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const filter: Record<string, unknown> = { bookingType: 'invoice' };
  if (req.user.role !== 'admin') {
    filter.userId = req.user._id;
  }

  const invoices = await Booking.find(filter)
    .populate('userId', 'name email phone')
    .populate('propertyId', 'name address')
    .populate('roomId', 'roomNumber sharingType isAC electricityRatePerUnit')
    .populate('bedId', 'bedCode')
    .sort({ billingMonth: -1, createdAt: -1 })
    .lean();

  res.json({ invoices });
}

export async function createInvoice(req: Request, res: Response): Promise<void> {
  const parsed = createInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid invoice payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { userId, billingMonth, electricityUnits, mealDeduction, notes } = parsed.data;
  const resident = await User.findById(userId);
  if (!resident || !resident.assignedRoomId || !resident.assignedPropertyId) {
    res.status(400).json({ error: 'Resident does not have an assigned room.' });
    return;
  }

  const room = await Room.findById(resident.assignedRoomId).lean();
  const property = await Property.findById(resident.assignedPropertyId).lean();
  if (!room || !property) {
    res.status(404).json({ error: 'Assigned room or property not found.' });
    return;
  }

  const baseRent = room.monthlyRent;
  const electricityCharge = Math.round(electricityUnits * room.electricityRatePerUnit);
  const gstRate = property.houseRulesSummary?.gstRatePercent ?? 0;
  const subtotal = Math.max(0, baseRent + electricityCharge - mealDeduction);
  const gstAmount = Math.round((subtotal * gstRate) / 100);
  const totalAmount = subtotal + gstAmount;

  const invoice = await Booking.create({
    bookingType: 'invoice',
    propertyId: property._id,
    roomId: room._id,
    bedId: resident.assignedBedId ?? null,
    userId: resident._id,
    billingMonth,
    baseRent,
    electricityUnits,
    electricityCharge,
    mealDeduction,
    gstAmount,
    totalAmount,
    paymentStatus: 'unpaid',
    hraEligible: true,
    status: 'pending',
    notes,
  });

  res.status(201).json({
    message: 'Monthly rent invoice generated.',
    invoice,
  });
}

export async function payInvoice(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid invoice ID.' });
    return;
  }

  const parsed = payInvoiceSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Invalid payment gateway selection.' });
    return;
  }

  const invoice = await Booking.findOne({ _id: id, bookingType: 'invoice' });
  if (!invoice) {
    res.status(404).json({ error: 'Invoice not found.' });
    return;
  }

  if (
    req.user.role !== 'admin' &&
    invoice.userId?.toString() !== req.user._id.toString()
  ) {
    res.status(403).json({ error: 'You can only pay your own invoices.' });
    return;
  }

  if (invoice.paymentStatus === 'paid') {
    res.status(409).json({ error: 'This invoice is already paid.' });
    return;
  }

  const suffix = crypto.randomBytes(3).toString('hex').toUpperCase();
  invoice.paymentStatus = 'paid';
  invoice.paymentGateway = parsed.data.paymentGateway;
  invoice.transactionId = `${parsed.data.paymentGateway}_${suffix}`;
  invoice.paidAt = new Date();
  invoice.receiptNumber = `HS-HRA-${invoice.billingMonth ?? '2026'}-${suffix}`;
  invoice.status = 'completed';
  await invoice.save();

  res.json({
    message: 'Payment successful. HRA/GST receipt is ready for download.',
    invoice,
  });
}
