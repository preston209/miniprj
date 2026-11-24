import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { z } from 'zod';
import { Property, type IDailyMenu } from '../models/Property.ts';
import { seedDatabase } from '../seeds/seedService.ts';

const DEFAULT_EMPTY_MENU: IDailyMenu[] = (
  [
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ] as const
).map((day) => ({
  day,
  breakfast: [],
  lunch: [],
  dinner: [],
}));

const menuItemSchema = z.object({
  name: z.string().trim().min(1).max(120),
  dietary: z.enum(['veg', 'non-veg', 'jain']),
});

const dailyMenuSchema = z.object({
  day: z.enum([
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
    'Sunday',
  ]),
  breakfast: z.array(menuItemSchema).max(12),
  lunch: z.array(menuItemSchema).max(12),
  dinner: z.array(menuItemSchema).max(12),
});

const mealTimingsSchema = z.object({
  breakfast: z.string().trim().min(2).max(60),
  lunch: z.string().trim().min(2).max(60),
  dinner: z.string().trim().min(2).max(60),
});

const updateMenuSchema = z.object({
  weeklyMenu: z.array(dailyMenuSchema).min(1).max(7),
  mealTimings: mealTimingsSchema.optional(),
});

const houseRulesSchema = z.object({
  curfewTime: z.string().trim().min(2).max(200).optional(),
  visitorHours: z.string().trim().min(2).max(200).optional(),
  overnightGuestPolicy: z.string().trim().min(2).max(300).optional(),
  quietHours: z.string().trim().min(2).max(100).optional(),
  smokingAlcoholPolicy: z.string().trim().min(2).max(300).optional(),
  securityDepositRefundDays: z.number().int().min(1).max(60).optional(),
  gstRatePercent: z.number().min(0).max(28).optional(),
});

const upsertPropertySchema = z.object({
  name: z.string().trim().min(2).max(140),
  tagline: z.string().trim().max(200).optional(),
  description: z.string().trim().min(10).max(2000),
  address: z.object({
    line1: z.string().trim().min(2).max(200),
    area: z.string().trim().min(2).max(120),
    city: z.string().trim().min(2).max(100),
    state: z.string().trim().min(2).max(100),
    pincode: z.string().trim().min(4).max(12),
    landmarks: z.array(z.string().trim().max(120)).default([]),
  }),
  googleMapsUrl: z.string().trim().max(500).optional(),
  contactPhone: z.string().trim().min(6).max(25),
  contactEmail: z.string().trim().toLowerCase().email(),
  genderPolicy: z.enum(['co-ed', 'male-only', 'female-only']).default('co-ed'),
  electricityRatePerUnit: z.number().min(0).max(50).default(9),
  amenities: z.array(z.string().trim().max(100)).default([]),
  houseRulesSummary: houseRulesSchema.optional(),
  mealTimings: mealTimingsSchema.optional(),
  heroImageUrl: z.string().trim().max(500).optional(),
});

function makeSlug(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'havenstay-pg'
  );
}

export async function listProperties(_req: Request, res: Response): Promise<void> {
  const properties = await Property.find({ isActive: true }).sort({ createdAt: 1 }).lean();
  res.json({ properties });
}

export async function getPrimaryProperty(_req: Request, res: Response): Promise<void> {
  let property = await Property.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();
  if (!property && process.env.SEED_SAMPLE_DATA === 'true') {
    await seedDatabase();
    property = await Property.findOne({ isActive: true }).sort({ createdAt: 1 }).lean();
  }
  res.json({ property: property ?? null });
}

export async function createProperty(req: Request, res: Response): Promise<void> {
  const parsed = upsertPropertySchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid property details.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const data = parsed.data;
  let slug = makeSlug(data.name);
  const conflict = await Property.findOne({ slug }).select('_id').lean();
  if (conflict) {
    slug = `${slug}-${Date.now().toString().slice(-4)}`;
  }

  const property = await Property.create({
    ...data,
    slug,
    weeklyMenu: DEFAULT_EMPTY_MENU,
    isActive: true,
  });

  res.status(201).json({
    message: 'Property created and synced to AI knowledge base.',
    property,
  });
}

export async function updateProperty(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid property ID.' });
    return;
  }

  const parsed = upsertPropertySchema.partial().safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid property update payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const property = await Property.findById(id);
  if (!property) {
    res.status(404).json({ error: 'Property not found.' });
    return;
  }

  const d = parsed.data;
  if (d.name !== undefined) property.name = d.name;
  if (d.tagline !== undefined) property.tagline = d.tagline;
  if (d.description !== undefined) property.description = d.description;
  if (d.address !== undefined) property.address = d.address;
  if (d.googleMapsUrl !== undefined) property.googleMapsUrl = d.googleMapsUrl;
  if (d.contactPhone !== undefined) property.contactPhone = d.contactPhone;
  if (d.contactEmail !== undefined) property.contactEmail = d.contactEmail;
  if (d.genderPolicy !== undefined) property.genderPolicy = d.genderPolicy;
  if (d.electricityRatePerUnit !== undefined) {
    property.electricityRatePerUnit = d.electricityRatePerUnit;
  }
  if (d.amenities !== undefined) property.amenities = d.amenities;
  if (d.heroImageUrl !== undefined) property.heroImageUrl = d.heroImageUrl;
  if (d.houseRulesSummary !== undefined) {
    property.houseRulesSummary = {
      ...property.houseRulesSummary,
      ...d.houseRulesSummary,
    };
  }
  if (d.mealTimings !== undefined) {
    property.mealTimings = d.mealTimings;
  }

  await property.save(); // Triggers automated Property post('save') RAG sync hook

  res.json({
    message: 'Property details updated and synced to AI knowledge base.',
    property,
  });
}

export async function updateWeeklyMenu(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid property ID.' });
    return;
  }

  const parsed = updateMenuSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid weekly menu payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const property = await Property.findById(id);
  if (!property) {
    res.status(404).json({ error: 'Property not found.' });
    return;
  }

  property.weeklyMenu = parsed.data.weeklyMenu;
  if (parsed.data.mealTimings) {
    property.mealTimings = parsed.data.mealTimings;
  }
  await property.save(); // Triggers automated Property post('save') vector sync hook

  res.json({
    message: 'Weekly menu updated and synced to AI knowledge base.',
    property,
  });
}

export async function updateHouseRules(req: Request, res: Response): Promise<void> {
  const id = req.params.id;
  if (typeof id !== 'string' || !Types.ObjectId.isValid(id)) {
    res.status(400).json({ error: 'Invalid property ID.' });
    return;
  }

  const parsed = houseRulesSchema.safeParse(req.body);
  if (!parsed.success) {
    res.status(400).json({
      error: 'Invalid house rules payload.',
      details: parsed.error.flatten().fieldErrors,
    });
    return;
  }

  const property = await Property.findById(id);
  if (!property) {
    res.status(404).json({ error: 'Property not found.' });
    return;
  }

  property.houseRulesSummary = {
    ...property.houseRulesSummary,
    ...parsed.data,
  };
  await property.save(); // Triggers automated Property post('save') vector sync hook

  res.json({
    message: 'House rules updated and synced to AI knowledge base.',
    property,
  });
}
