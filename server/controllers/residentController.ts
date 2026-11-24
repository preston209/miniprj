import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import type { AuthenticatedRequest } from '../middleware/authMiddleware.ts';
import { Bed } from '../models/Bed.ts';
import { Booking } from '../models/Booking.ts';
import { Property } from '../models/Property.ts';
import { Room } from '../models/Room.ts';
import { User } from '../models/User.ts';

const mealOptOutSchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected YYYY-MM-DD date format'),
  meals: z.array(z.enum(['breakfast', 'lunch', 'dinner'])).max(3),
});

const onboardResidentSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(8).max(100).optional(),
  gender: z.enum(['male', 'female', 'other']).default('male'),
  occupation: z.string().trim().max(120).optional(),
  bedId: z.string().refine((val) => Types.ObjectId.isValid(val), 'Invalid bedId'),
  checkInDate: z.string().optional(),
  billingMonth: z
    .string()
    .regex(/^\d{4}-\d{2}$/, 'Expected YYYY-MM format')
    .optional(),
  electricityUnits: z.number().min(0).max(5000).default(0),
  includeDeposit: z.boolean().default(true),
  tourBookingId: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), 'Invalid tourBookingId')
    .optional(),
});

export async function listResidents(_req: Request, res: Response): Promise<void> {
  const users = await User.find({ role: { $in: ['resident', 'guest'] } })
    .populate('assignedRoomId', 'roomNumber sharingType isAC')
    .populate('assignedBedId', 'bedCode status')
    .sort({ role: -1, name: 1 })
    .lean();

  res.json({ residents: users });
}

export async function onboardResident(req: Request, res: Response): Promise<void> {
  const parsed = onboardResidentSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid resident onboarding details.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const data = parsed.data;
  const bed = await Bed.findById(data.bedId);
  if (!bed) {
    res.status(404).json({ error: 'Selected bed not found.' });
    return;
  }

  if (bed.status !== 'available') {
    res.status(409).json({
      error: `Bed ${bed.bedCode} is currently ${bed.status} and cannot be assigned.`,
    });
    return;
  }

  const [room, property] = await Promise.all([
    Room.findById(bed.roomId).lean(),
    Property.findById(bed.propertyId).lean(),
  ]);

  if (!room || !property) {
    res.status(404).json({ error: 'Room or property for this bed was not found.' });
    return;
  }

  const resolvedCheckIn = data.checkInDate ? new Date(data.checkInDate) : new Date();
  if (Number.isNaN(resolvedCheckIn.getTime())) {
    res.status(400).json({ error: 'Invalid check-in date.' });
    return;
  }

  let resident = await User.findOne({ email: data.email });
  if (resident) {
    if (resident.role === 'admin') {
      res.status(409).json({
        error: 'An administrator account cannot be onboarded as a PG resident.',
      });
      return;
    }
    if (resident.assignedBedId && resident.assignedBedId.toString() !== bed._id.toString()) {
      res.status(409).json({
        error: 'This user is already assigned to another bed. Vacate their existing bed first.',
      });
      return;
    }

    resident.name = data.name;
    resident.phone = data.phone;
    resident.gender = data.gender;
    if (data.occupation !== undefined) resident.occupation = data.occupation;
    if (data.password) resident.passwordHash = data.password;
    resident.role = 'resident';
    resident.kycVerified = true;
    resident.assignedPropertyId = bed.propertyId;
    resident.assignedRoomId = bed.roomId;
    resident.assignedBedId = bed._id;
    resident.checkInDate = resolvedCheckIn;
    resident.noticeEndDate = null;
    await resident.save();
  } else {
    if (!data.password) {
      res.status(400).json({
        error: 'A temporary password (minimum 8 characters) is required for a new resident.',
      });
      return;
    }

    resident = await User.create({
      name: data.name,
      email: data.email,
      phone: data.phone,
      passwordHash: data.password,
      role: 'resident',
      gender: data.gender,
      occupation: data.occupation,
      kycVerified: true,
      assignedPropertyId: bed.propertyId,
      assignedRoomId: bed.roomId,
      assignedBedId: bed._id,
      checkInDate: resolvedCheckIn,
      noticeEndDate: null,
    });
  }

  bed.status = 'occupied';
  bed.currentTenantId = resident._id;
  bed.checkInDate = resolvedCheckIn;
  bed.noticeGivenDate = null;
  bed.expectedVacateDate = null;
  await bed.save(); // Recalculates room vacancy and syncs room_inventory to RAG

  const billingMonth = data.billingMonth ?? new Date().toISOString().slice(0, 7);
  const baseRent = room.monthlyRent;
  const securityDepositCharge = data.includeDeposit ? room.securityDeposit : 0;
  const electricityCharge = Math.round(data.electricityUnits * room.electricityRatePerUnit);
  const gstRate = property.houseRulesSummary?.gstRatePercent ?? 0;
  const gstAmount = Math.round(((baseRent + electricityCharge) * gstRate) / 100);
  const totalAmount = baseRent + securityDepositCharge + electricityCharge + gstAmount;

  const invoice = await Booking.create({
    bookingType: 'invoice',
    propertyId: property._id,
    roomId: room._id,
    bedId: bed._id,
    userId: resident._id,
    billingMonth,
    baseRent,
    securityDepositCharge,
    electricityUnits: data.electricityUnits,
    electricityCharge,
    mealDeduction: 0,
    gstAmount,
    totalAmount,
    paymentStatus: 'unpaid',
    hraEligible: true,
    status: 'pending',
    notes: data.includeDeposit
      ? 'Move-in invoice (Monthly Rent + Refundable Security Deposit)'
      : 'Initial monthly rent invoice',
  });

  if (data.tourBookingId) {
    await Booking.findOneAndUpdate(
      { _id: data.tourBookingId, bookingType: 'tour' },
      {
        $set: {
          status: 'converted_to_resident',
          userId: resident._id,
          roomId: room._id,
        },
      }
    );
  }

  res.status(201).json({
    message: `Onboarded ${resident.name} to Bed ${bed.bedCode} and generated initial invoice.`,
    resident: {
      id: resident._id,
      name: resident.name,
      email: resident.email,
      role: resident.role,
    },
    bed,
    invoice,
  });
}

export async function getMyMealOptOuts(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  res.json({ mealOptOuts: req.user.mealOptOuts ?? [] });
}

export async function toggleMealOptOut(
  req: AuthenticatedRequest,
  res: Response
): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Authentication required.' });
    return;
  }

  const parsed = mealOptOutSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid meal opt-out request.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { date, meals } = parsed.data;
  const user = await User.findById(req.user._id);
  if (!user) {
    res.status(404).json({ error: 'User not found.' });
    return;
  }

  const remaining = (user.mealOptOuts ?? []).filter((entry) => entry.date !== date);
  if (meals.length > 0) {
    remaining.push({ date, meals: Array.from(new Set(meals)) });
  }
  remaining.sort((a, b) => a.date.localeCompare(b.date));

  user.mealOptOuts = remaining;
  await user.save();

  res.json({
    message: `Meal preferences updated for ${date}.`,
    mealOptOuts: user.mealOptOuts,
  });
}
