import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Bed } from '../models/Bed.ts';
import { KnowledgeChunk } from '../models/KnowledgeChunk.ts';
import { Property } from '../models/Property.ts';
import { Room } from '../models/Room.ts';
import { User } from '../models/User.ts';
import { seedDatabase } from '../seeds/seedService.ts';

const createRoomSchema = z.object({
  propertyId: z.string().refine((val) => Types.ObjectId.isValid(val), 'Invalid propertyId'),
  roomNumber: z.string().trim().min(1).max(20),
  floor: z.number().int().min(0).max(50),
  sharingType: z.enum(['single', 'double', 'triple']),
  isAC: z.boolean(),
  genderPreference: z.enum(['male', 'female', 'any']),
  monthlyRent: z.number().min(1000).max(200000),
  securityDeposit: z.number().min(0).max(500000),
  lockInMonths: z.number().int().min(0).max(24).default(2),
  noticePeriodDays: z.number().int().min(7).max(90).default(30),
  electricityRatePerUnit: z.number().min(0).max(50).default(9),
  estimatedMonthlyElectricity: z.number().min(0).max(20000).default(900),
  amenities: z.array(z.string().trim().max(80)).default([]),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(500).optional(),
});

const updateRoomSchema = z.object({
  roomNumber: z.string().trim().min(1).max(20).optional(),
  floor: z.number().int().min(0).max(50).optional(),
  sharingType: z.enum(['single', 'double', 'triple']).optional(),
  monthlyRent: z.number().min(1000).max(200000).optional(),
  securityDeposit: z.number().min(0).max(500000).optional(),
  lockInMonths: z.number().int().min(0).max(24).optional(),
  noticePeriodDays: z.number().int().min(7).max(90).optional(),
  electricityRatePerUnit: z.number().min(0).max(50).optional(),
  estimatedMonthlyElectricity: z.number().min(0).max(20000).optional(),
  isAC: z.boolean().optional(),
  genderPreference: z.enum(['male', 'female', 'any']).optional(),
  amenities: z.array(z.string().trim().max(80)).optional(),
  description: z.string().trim().max(500).optional(),
  imageUrl: z.string().trim().max(500).optional(),
  isActive: z.boolean().optional(),
});

const allocateBedSchema = z.object({
  status: z.enum(['available', 'occupied', 'notice_period', 'reserved', 'maintenance']),
  tenantId: z
    .string()
    .refine((val) => Types.ObjectId.isValid(val), 'Invalid tenantId')
    .nullable()
    .optional(),
  checkInDate: z.string().nullable().optional(),
  noticeGivenDate: z.string().nullable().optional(),
  expectedVacateDate: z.string().nullable().optional(),
  notes: z.string().trim().max(300).optional(),
});

export async function listRooms(req: Request, res: Response): Promise<void> {
  if (process.env.SEED_SAMPLE_DATA === 'true') {
    const existingPropertyCount = await Property.countDocuments({ isActive: true });
    if (existingPropertyCount === 0) {
      await seedDatabase();
    }
  }

  const query: Record<string, unknown> = { isActive: true };

  if (typeof req.query.propertyId === 'string' && Types.ObjectId.isValid(req.query.propertyId)) {
    query.propertyId = new Types.ObjectId(req.query.propertyId);
  }

  if (
    typeof req.query.sharingType === 'string' &&
    ['single', 'double', 'triple'].includes(req.query.sharingType)
  ) {
    query.sharingType = req.query.sharingType;
  }

  if (req.query.isAC === 'true') {
    query.isAC = true;
  } else if (req.query.isAC === 'false') {
    query.isAC = false;
  }

  if (
    typeof req.query.genderPreference === 'string' &&
    ['male', 'female', 'any'].includes(req.query.genderPreference)
  ) {
    query.genderPreference = req.query.genderPreference;
  }

  if (req.query.onlyAvailable === 'true') {
    query.vacantBedsCount = { $gt: 0 };
  }

  const rooms = await Room.find(query)
    .populate('propertyId', 'name slug address houseRulesSummary')
    .sort({ floor: 1, roomNumber: 1 })
    .lean();

  res.json({ rooms });
}

export async function getRoomById(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid room ID.' });
    return;
  }

  const room = await Room.findById(id)
    .populate('propertyId', 'name slug address houseRulesSummary')
    .lean();
  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  const beds = await Bed.find({ roomId: room._id })
    .select('bedCode status expectedVacateDate')
    .sort({ bedCode: 1 })
    .lean();

  res.json({ room, beds });
}

export async function createRoom(req: Request, res: Response): Promise<void> {
  const parsed = createRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid room data.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const data = parsed.data;
  const property = await Property.findById(data.propertyId).select('_id').lean();
  if (!property) {
    res.status(404).json({ error: 'Target property not found.' });
    return;
  }

  const totalBeds =
    data.sharingType === 'single' ? 1 : data.sharingType === 'double' ? 2 : 3;

  const room = await Room.create({
    ...data,
    propertyId: property._id,
    totalBeds,
    vacantBedsCount: totalBeds,
    isActive: true,
  });

  const suffixes = ['A', 'B', 'C'];
  for (let i = 0; i < totalBeds; i++) {
    await Bed.create({
      propertyId: property._id,
      roomId: room._id,
      bedCode: `${room.roomNumber}-${suffixes[i]}`,
      status: 'available',
    });
  }

  res.status(201).json({
    message: 'Room and beds created and synced to AI knowledge base.',
    room,
  });
}

export async function updateRoom(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid room ID.' });
    return;
  }

  const parsed = updateRoomSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid room update payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const updated = await Room.findByIdAndUpdate(
    id,
    { $set: parsed.data },
    { new: true, runValidators: true }
  );

  if (!updated) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  res.json({
    message: 'Room updated and synced to AI knowledge base.',
    room: updated,
  });
}

export async function deleteRoom(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid room ID.' });
    return;
  }

  const room = await Room.findById(id);
  if (!room) {
    res.status(404).json({ error: 'Room not found.' });
    return;
  }

  const occupiedCount = await Bed.countDocuments({
    roomId: room._id,
    status: { $in: ['occupied', 'notice_period'] },
  });
  if (occupiedCount > 0) {
    res.status(409).json({
      error:
        'Cannot delete a room with occupied or notice-period beds. Vacate assigned beds first.',
    });
    return;
  }

  await Promise.all([
    Bed.deleteMany({ roomId: room._id }),
    KnowledgeChunk.deleteMany({
      'metadata.propertyId': room.propertyId,
      'metadata.sourceType': 'room_inventory',
      'metadata.roomId': room._id,
    }),
    Room.findByIdAndDelete(room._id),
  ]);

  res.json({
    message: `Room ${room.roomNumber} and its AI inventory chunks were deleted.`,
  });
}

export async function getBedMatrix(req: Request, res: Response): Promise<void> {
  const filter: Record<string, unknown> = {};
  if (typeof req.query.propertyId === 'string' && Types.ObjectId.isValid(req.query.propertyId)) {
    filter.propertyId = new Types.ObjectId(req.query.propertyId);
  }

  const beds = await Bed.find(filter)
    .populate('roomId', 'roomNumber floor sharingType isAC genderPreference monthlyRent')
    .populate('currentTenantId', 'name email phone gender occupation noticeEndDate')
    .sort({ bedCode: 1 })
    .lean();

  res.json({ beds });
}

export async function allocateBed(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid bed ID.' });
    return;
  }

  const parsed = allocateBedSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid bed allocation payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const bed = await Bed.findById(id);
  if (!bed) {
    res.status(404).json({ error: 'Bed not found.' });
    return;
  }

  const { status, tenantId, checkInDate, noticeGivenDate, expectedVacateDate, notes } =
    parsed.data;

  const previousTenantId = bed.currentTenantId;

  if (status === 'available' || status === 'maintenance') {
    // Vacating or blocking bed
    bed.status = status;
    bed.currentTenantId = null;
    bed.checkInDate = null;
    bed.noticeGivenDate = null;
    bed.expectedVacateDate = null;
    if (notes !== undefined) bed.notes = notes;
    await bed.save();

    if (previousTenantId) {
      await User.findByIdAndUpdate(previousTenantId, {
        $set: {
          assignedBedId: null,
          assignedRoomId: null,
          noticeEndDate: null,
        },
      });
    }
  } else {
    // Occupying, notice_period, or reserving bed
    if (
      (status === 'occupied' || status === 'notice_period') &&
      !tenantId &&
      !bed.currentTenantId
    ) {
      res.status(400).json({
        error: 'A resident must be selected for occupied or notice-period beds.',
      });
      return;
    }

    const resolvedTenantId = tenantId
      ? new Types.ObjectId(tenantId)
      : bed.currentTenantId ?? null;

    // Unlink previous tenant if bed switched hands
    if (
      previousTenantId &&
      resolvedTenantId &&
      previousTenantId.toString() !== resolvedTenantId.toString()
    ) {
      await User.findByIdAndUpdate(previousTenantId, {
        $set: { assignedBedId: null, assignedRoomId: null, noticeEndDate: null },
      });
    }

    if (resolvedTenantId) {
      const tenant = await User.findById(resolvedTenantId);
      if (!tenant) {
        res.status(404).json({ error: 'Selected tenant user not found.' });
        return;
      }
      if (tenant.role === 'guest') {
        tenant.role = 'resident';
      }
      tenant.assignedPropertyId = bed.propertyId;
      tenant.assignedRoomId = bed.roomId;
      tenant.assignedBedId = bed._id;
      tenant.checkInDate = checkInDate ? new Date(checkInDate) : tenant.checkInDate ?? new Date();
      tenant.noticeEndDate =
        status === 'notice_period'
          ? expectedVacateDate
            ? new Date(expectedVacateDate)
            : tenant.noticeEndDate ?? new Date(Date.now() + 30 * 86_400_000)
          : expectedVacateDate
          ? new Date(expectedVacateDate)
          : null;
      await tenant.save();
    }

    bed.status = status;
    bed.currentTenantId = resolvedTenantId;
    bed.checkInDate = checkInDate ? new Date(checkInDate) : bed.checkInDate ?? new Date();
    bed.noticeGivenDate =
      status === 'notice_period'
        ? noticeGivenDate
          ? new Date(noticeGivenDate)
          : bed.noticeGivenDate ?? new Date()
        : noticeGivenDate
        ? new Date(noticeGivenDate)
        : null;
    bed.expectedVacateDate =
      status === 'notice_period'
        ? expectedVacateDate
          ? new Date(expectedVacateDate)
          : bed.expectedVacateDate ?? new Date(Date.now() + 30 * 86_400_000)
        : expectedVacateDate
        ? new Date(expectedVacateDate)
        : null;
    if (notes !== undefined) bed.notes = notes;
    await bed.save(); // Triggers Bed post-save hook -> recalculates Room vacancy & updates vector embeddings
  }

  const updatedBed = await Bed.findById(bed._id)
    .populate('roomId', 'roomNumber floor sharingType isAC vacantBedsCount totalBeds')
    .populate('currentTenantId', 'name email phone');

  res.json({
    message: 'Bed allocation updated and room availability synced.',
    bed: updatedBed,
  });
}
