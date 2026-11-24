import { z } from 'zod';
import { Bed } from '../models/Bed.ts';
import { Booking } from '../models/Booking.ts';
import {
  KnowledgeChunk,
  type KnowledgeSourceType,
} from '../models/KnowledgeChunk.ts';
import { Property } from '../models/Property.ts';
import { Room } from '../models/Room.ts';
import { Ticket } from '../models/Ticket.ts';
import { User } from '../models/User.ts';
import { isGeminiConfigured } from '../utils/geminiClient.ts';
import {
  syncPropertyMenuAndRulesToKnowledge,
  syncRoomToKnowledge,
} from './knowledgeSyncService.ts';
import { ingestDocument } from './ragIngestionService.ts';

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
  breakfast: z.array(menuItemSchema).default([]),
  lunch: z.array(menuItemSchema).default([]),
  dinner: z.array(menuItemSchema).default([]),
});

export const realPgImportSchema = z.object({
  property: z.object({
    name: z.string().trim().min(2).max(140),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .regex(/^[a-z0-9-]+$/, 'Slug must be lowercase letters, numbers, and hyphens')
      .optional(),
    tagline: z.string().trim().max(200).default('Managed Executive PG Accommodation'),
    description: z.string().trim().min(10).max(2000),
    address: z.object({
      line1: z.string().trim().min(2),
      area: z.string().trim().min(2),
      city: z.string().trim().min(2),
      state: z.string().trim().min(2),
      pincode: z.string().trim().min(4).max(12),
      landmarks: z.array(z.string().trim()).default([]),
    }),
    googleMapsUrl: z.string().trim().max(500).optional(),
    contactPhone: z.string().trim().min(6).max(25),
    contactEmail: z.string().trim().toLowerCase().email(),
    genderPolicy: z.enum(['co-ed', 'male-only', 'female-only']).default('co-ed'),
    electricityRatePerUnit: z.number().min(0).max(50).default(9),
    amenities: z.array(z.string().trim()).default([]),
    houseRulesSummary: z.object({
      curfewTime: z.string().trim(),
      visitorHours: z.string().trim(),
      overnightGuestPolicy: z.string().trim(),
      quietHours: z.string().trim(),
      smokingAlcoholPolicy: z.string().trim(),
      securityDepositRefundDays: z.number().int().min(1).max(60).default(7),
      gstRatePercent: z.number().min(0).max(28).default(0),
    }),
    mealTimings: z
      .object({
        breakfast: z.string().trim().min(2).max(60),
        lunch: z.string().trim().min(2).max(60),
        dinner: z.string().trim().min(2).max(60),
      })
      .optional(),
    heroImageUrl: z.string().trim().max(500).optional(),
  }),
  rooms: z
    .array(
      z.object({
        roomNumber: z.string().trim().min(1).max(20),
        floor: z.number().int().min(0).max(50),
        sharingType: z.enum(['single', 'double', 'triple']),
        isAC: z.boolean(),
        genderPreference: z.enum(['male', 'female', 'any']).default('any'),
        monthlyRent: z.number().min(1000).max(200000),
        securityDeposit: z.number().min(0).max(500000),
        lockInMonths: z.number().int().min(0).max(24).default(2),
        noticePeriodDays: z.number().int().min(7).max(90).default(30),
        electricityRatePerUnit: z.number().min(0).max(50).default(9),
        estimatedMonthlyElectricity: z.number().min(0).max(20000).default(900),
        amenities: z.array(z.string().trim()).default([]),
        totalBeds: z.number().int().min(1).max(6).optional(),
        description: z.string().trim().max(500).optional(),
        imageUrl: z.string().trim().max(500).optional(),
      })
    )
    .min(1),
  weeklyMenu: z.array(dailyMenuSchema).default([]),
  knowledgeDocuments: z
    .array(
      z.object({
        sourceType: z
          .enum([
            'house_rules',
            'policy',
            'neighborhood_guide',
            'faq',
            'uploaded_doc',
          ])
          .default('policy'),
        sourceSection: z.string().trim().min(2).max(160),
        title: z.string().trim().min(2).max(160),
        category: z.string().trim().max(60).optional(),
        content: z.string().trim().min(10).max(100000),
      })
    )
    .default([]),
});

export type RealPgImportPayload = z.infer<typeof realPgImportSchema>;

export async function clearSampleNonAdminData(): Promise<{
  deletedKnowledgeChunks: number;
  deletedTickets: number;
  deletedBookings: number;
  deletedBeds: number;
  deletedRooms: number;
  deletedProperties: number;
  deletedNonAdminUsers: number;
}> {
  const [chunks, tickets, bookings, beds, rooms, properties, nonAdmins] =
    await Promise.all([
      KnowledgeChunk.deleteMany({}),
      Ticket.deleteMany({}),
      Booking.deleteMany({}),
      Bed.deleteMany({}),
      Room.deleteMany({}),
      Property.deleteMany({}),
      User.deleteMany({ role: { $ne: 'admin' } }),
    ]);

  return {
    deletedKnowledgeChunks: chunks.deletedCount ?? 0,
    deletedTickets: tickets.deletedCount ?? 0,
    deletedBookings: bookings.deletedCount ?? 0,
    deletedBeds: beds.deletedCount ?? 0,
    deletedRooms: rooms.deletedCount ?? 0,
    deletedProperties: properties.deletedCount ?? 0,
    deletedNonAdminUsers: nonAdmins.deletedCount ?? 0,
  };
}

function slugifyName(name: string): string {
  return (
    name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 64) || 'havenstay-pg'
  );
}

export async function importRealPgData(params: {
  data: RealPgImportPayload;
  markdownRules?: string;
  markdownTitle?: string;
  replaceExisting?: boolean;
}): Promise<{
  propertyId: string;
  propertyName: string;
  roomsCreated: number;
  bedsCreated: number;
  knowledgeChunksCreated: number;
  embeddedWithGemini: boolean;
}> {
  const parsed = realPgImportSchema.parse(params.data);

  if (params.replaceExisting !== false) {
    await clearSampleNonAdminData();
  }

  const prevSkip = process.env.SKIP_VECTOR_HOOKS;
  process.env.SKIP_VECTOR_HOOKS = 'true';

  let property;
  let roomsCreated = 0;
  let bedsCreated = 0;

  try {
    const resolvedSlug =
      parsed.property.slug || slugifyName(parsed.property.name);

    property = await Property.create({
      ...parsed.property,
      slug: resolvedSlug,
      weeklyMenu: parsed.weeklyMenu,
      isActive: true,
    });

    const createdRooms = [];
    const suffixes = ['A', 'B', 'C', 'D', 'E', 'F'];

    for (const r of parsed.rooms) {
      const totalBeds =
        r.totalBeds ??
        (r.sharingType === 'single' ? 1 : r.sharingType === 'double' ? 2 : 3);

      const room = await Room.create({
        propertyId: property._id,
        roomNumber: r.roomNumber,
        floor: r.floor,
        sharingType: r.sharingType,
        isAC: r.isAC,
        genderPreference: r.genderPreference,
        monthlyRent: r.monthlyRent,
        securityDeposit: r.securityDeposit,
        lockInMonths: r.lockInMonths,
        noticePeriodDays: r.noticePeriodDays,
        electricityRatePerUnit: r.electricityRatePerUnit,
        estimatedMonthlyElectricity: r.estimatedMonthlyElectricity,
        amenities: r.amenities,
        totalBeds,
        vacantBedsCount: totalBeds,
        description: r.description,
        imageUrl: r.imageUrl,
        isActive: true,
      });

      createdRooms.push(room);
      roomsCreated++;

      for (let i = 0; i < totalBeds; i++) {
        await Bed.create({
          propertyId: property._id,
          roomId: room._id,
          bedCode: `${room.roomNumber}-${suffixes[i] ?? i + 1}`,
          status: 'available',
        });
        bedsCreated++;
      }
    }

    // Re-enable hooks after creation and sync fresh 768-dim Gemini embeddings cleanly
    if (prevSkip === undefined) {
      delete process.env.SKIP_VECTOR_HOOKS;
    } else {
      process.env.SKIP_VECTOR_HOOKS = prevSkip;
    }

    await syncPropertyMenuAndRulesToKnowledge(property);
    for (const room of createdRooms) {
      await syncRoomToKnowledge(room);
    }

    for (const doc of parsed.knowledgeDocuments) {
      await ingestDocument({
        propertyId: property._id,
        sourceType: doc.sourceType as KnowledgeSourceType,
        sourceSection: doc.sourceSection,
        title: doc.title,
        category: doc.category,
        content: doc.content,
      });
    }

    if (params.markdownRules && params.markdownRules.trim().length >= 10) {
      await ingestDocument({
        propertyId: property._id,
        sourceType: 'house_rules',
        sourceSection: params.markdownTitle?.trim() || 'PG Rulebook (Imported Markdown)',
        title: params.markdownTitle?.trim() || `${property.name} Rulebook`,
        category: 'policy',
        content: params.markdownRules,
      });
    }

    const totalChunks = await KnowledgeChunk.countDocuments({
      'metadata.propertyId': property._id,
    });

    return {
      propertyId: property._id.toString(),
      propertyName: property.name,
      roomsCreated,
      bedsCreated,
      knowledgeChunksCreated: totalChunks,
      embeddedWithGemini: isGeminiConfigured(),
    };
  } finally {
    if (prevSkip === undefined) {
      delete process.env.SKIP_VECTOR_HOOKS;
    } else {
      process.env.SKIP_VECTOR_HOOKS = prevSkip;
    }
  }
}
