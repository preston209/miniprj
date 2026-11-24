import type { Request, Response } from 'express';
import { z } from 'zod';
import {
  clearAuthCookie,
  setAuthCookie,
  signAuthToken,
  type AuthenticatedRequest,
} from '../middleware/authMiddleware.ts';
import { User, type IUser } from '../models/User.ts';

const registerSchema = z.object({
  name: z.string().trim().min(2).max(100),
  email: z.string().trim().toLowerCase().email(),
  phone: z.string().trim().min(7).max(20),
  password: z.string().min(8).max(128),
  gender: z.enum(['male', 'female', 'other']).optional(),
  occupation: z.string().trim().max(120).optional(),
});

const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(1).max(128),
});

function serializeUser(user: IUser) {
  return {
    id: user._id.toString(),
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    gender: user.gender,
    occupation: user.occupation ?? null,
    kycVerified: user.kycVerified,
    assignedPropertyId: user.assignedPropertyId ?? null,
    assignedRoomId: user.assignedRoomId ?? null,
    assignedBedId: user.assignedBedId ?? null,
    checkInDate: user.checkInDate ?? null,
    noticeEndDate: user.noticeEndDate ?? null,
    mealOptOuts: user.mealOptOuts ?? [],
  };
}

export async function register(req: Request, res: Response): Promise<void> {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid registration details',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const { name, email, phone, password, gender, occupation } = parsed.data;
  const existing = await User.findOne({ email }).select('_id').lean();
  if (existing) {
    res.status(409).json({ error: 'An account with this email already exists.' });
    return;
  }

  // Self-registration always creates a 'guest' role; resident/admin promotion is admin-controlled
  const user = await User.create({
    name,
    email,
    phone,
    passwordHash: password,
    role: 'guest',
    gender: gender ?? 'male',
    occupation,
  });

  const token = signAuthToken(user);
  setAuthCookie(res, token);

  res.status(201).json({
    user: serializeUser(user),
  });
}

export async function login(req: Request, res: Response): Promise<void> {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({ error: 'Valid email and password are required.' });
    return;
  }

  const { email, password } = parsed.data;
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    res.status(401).json({ error: 'Invalid email or password.' });
    return;
  }

  const token = signAuthToken(user);
  setAuthCookie(res, token);

  res.json({
    user: serializeUser(user),
  });
}

export async function logout(_req: Request, res: Response): Promise<void> {
  clearAuthCookie(res);
  res.json({ message: 'Signed out successfully.' });
}

export async function getMe(req: AuthenticatedRequest, res: Response): Promise<void> {
  if (!req.user) {
    res.status(401).json({ error: 'Not authenticated.' });
    return;
  }

  const populated = await User.findById(req.user._id)
    .populate('assignedPropertyId', 'name slug address contactPhone contactEmail')
    .populate('assignedRoomId', 'roomNumber floor sharingType isAC monthlyRent securityDeposit')
    .populate('assignedBedId', 'bedCode status checkInDate noticeGivenDate expectedVacateDate');

  if (!populated) {
    res.status(404).json({ error: 'User profile not found.' });
    return;
  }

  res.json({
    user: serializeUser(populated),
  });
}

const bootstrapSchema = z.object({
  adminName: z.string().trim().min(2).max(100),
  adminEmail: z.string().trim().toLowerCase().email(),
  adminPassword: z.string().min(8).max(128),
});

export async function getSetupStatus(_req: Request, res: Response): Promise<void> {
  const adminCount = await User.countDocuments({ role: 'admin' });
  res.json({
    hasAdmin: adminCount > 0,
  });
}

export async function bootstrapAdmin(req: Request, res: Response): Promise<void> {
  const existingAdmin = await User.countDocuments({ role: 'admin' });
  if (existingAdmin > 0) {
    res.status(403).json({ error: 'Admin setup has already been completed and locked.' });
    return;
  }

  const parsed = bootstrapSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid setup details (minimum 8-character password required).',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  let sampleSeeded = false;
  if (process.env.SEED_SAMPLE_DATA === 'true') {
    const { seedDatabase } = await import('../seeds/seedService.ts');
    const summary = await seedDatabase({
      adminName: parsed.data.adminName,
      adminEmail: parsed.data.adminEmail,
      userPassword: parsed.data.adminPassword,
    });
    sampleSeeded = !summary.skipped;
  }

  let admin = await User.findOne({ email: parsed.data.adminEmail });
  if (!admin) {
    admin = await User.create({
      name: parsed.data.adminName,
      email: parsed.data.adminEmail,
      phone: '+91 00000 00000',
      passwordHash: parsed.data.adminPassword,
      role: 'admin',
      gender: 'male',
      occupation: 'Property Administrator',
      kycVerified: true,
    });
  }

  const token = signAuthToken(admin);
  setAuthCookie(res, token);

  res.status(201).json({
    message: sampleSeeded
      ? 'Admin claimed and sample records initialized.'
      : 'Admin account claimed. Configure your PG property, rooms, and rules in the dashboard.',
    user: serializeUser(admin),
  });
}
