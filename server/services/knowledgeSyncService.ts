import crypto from 'crypto';
import { Types } from 'mongoose';
import { Bed } from '../models/Bed.ts';
import { KnowledgeChunk } from '../models/KnowledgeChunk.ts';
import { Property, type IProperty } from '../models/Property.ts';
import { Room, type IRoom } from '../models/Room.ts';
import { generateEmbedding, isGeminiConfigured } from '../utils/geminiClient.ts';

function computeHash(value: string): string {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function upsertKnowledgeDocument(params: {
  sourceType: 'room_inventory' | 'weekly_menu' | 'house_rules' | 'policy';
  sourceSection: string;
  title: string;
  propertyId: Types.ObjectId;
  roomId?: Types.ObjectId | null;
  category: string;
  content: string;
  forceReembed?: boolean;
}): Promise<void> {
  const contentHash = computeHash(
    `${params.sourceType}:${params.sourceSection}:${params.content}`
  );

  const filter: Record<string, unknown> = {
    'metadata.propertyId': params.propertyId,
    'metadata.sourceType': params.sourceType,
    'metadata.sourceSection': params.sourceSection,
  };
  if (params.roomId) {
    filter['metadata.roomId'] = params.roomId;
  }

  const existing = await KnowledgeChunk.findOne(filter).select('contentHash embedding').lean();
  const hasRealEmbedding =
    existing &&
    Array.isArray(existing.embedding) &&
    existing.embedding.some((v) => v !== 0);

  // Skip re-embedding if content is unchanged and a real embedding exists (unless forceReembed requested)
  if (
    !params.forceReembed &&
    existing &&
    existing.contentHash === contentHash &&
    (hasRealEmbedding || !isGeminiConfigured())
  ) {
    return;
  }

  let embedding: number[];
  try {
    embedding = await generateEmbedding(`${params.title}\n${params.content}`);
  } catch (err) {
    console.warn('[KnowledgeSync] Embedding generation skipped/failed:', err);
    embedding = existing?.embedding ?? Array(768).fill(0);
  }

  await KnowledgeChunk.findOneAndUpdate(
    filter,
    {
      $set: {
        content: params.content,
        embedding,
        contentHash,
        chunkIndex: 0,
        metadata: {
          sourceType: params.sourceType,
          sourceSection: params.sourceSection,
          title: params.title,
          propertyId: params.propertyId,
          roomId: params.roomId ?? null,
          category: params.category,
          updatedAt: new Date(),
        },
      },
    },
    { upsert: true, new: true }
  );
}

export async function syncRoomToKnowledge(
  roomOrId: IRoom | Types.ObjectId | string,
  options?: { forceReembed?: boolean }
): Promise<void> {
  const room =
    typeof roomOrId === 'string' || roomOrId instanceof Types.ObjectId
      ? await Room.findById(roomOrId)
      : roomOrId;

  if (!room) {
    return;
  }

  const property = await Property.findById(room.propertyId).select('name').lean();
  const propertyName = property?.name ?? 'HavenStay PG';

  if (!room.isActive) {
    await KnowledgeChunk.deleteMany({
      'metadata.propertyId': room.propertyId,
      'metadata.sourceType': 'room_inventory',
      'metadata.roomId': room._id,
    });
    return;
  }

  const sourceSection = `Room ${room.roomNumber} (${room.sharingType.toUpperCase()} ${
    room.isAC ? 'AC' : 'Non-AC'
  })`;
  const title = `Room ${room.roomNumber} Pricing & Live Availability`;
  const content = `Room ${room.roomNumber} on Floor ${room.floor} at ${propertyName} is a ${
    room.sharingType
  }-sharing ${room.isAC ? 'AC' : 'Non-AC'} room (Gender preference: ${
    room.genderPreference
  }). Monthly rent is ₹${room.monthlyRent.toLocaleString(
    'en-IN'
  )} per bed, refundable security deposit is ₹${room.securityDeposit.toLocaleString(
    'en-IN'
  )}, lock-in period is ${room.lockInMonths} month(s), and notice period is ${
    room.noticePeriodDays
  } days. Electricity sub-meter rate is ₹${
    room.electricityRatePerUnit
  }/unit (estimated ₹${room.estimatedMonthlyElectricity}/month). Currently ${
    room.vacantBedsCount
  } out of ${room.totalBeds} bed(s) are vacant. Included amenities: ${
    room.amenities.length > 0 ? room.amenities.join(', ') : 'Standard PG furnishings'
  }.`;

  await upsertKnowledgeDocument({
    sourceType: 'room_inventory',
    sourceSection,
    title,
    propertyId: room.propertyId,
    roomId: room._id,
    category: 'rooms',
    content,
    forceReembed: options?.forceReembed,
  });
}

export async function recalculateRoomVacancy(
  roomId: Types.ObjectId | string
): Promise<IRoom | null> {
  const availableCount = await Bed.countDocuments({
    roomId,
    status: 'available',
  });

  const totalCount = await Bed.countDocuments({ roomId });

  const updatedRoom = await Room.findByIdAndUpdate(
    roomId,
    {
      $set: {
        vacantBedsCount: availableCount,
        ...(totalCount > 0 ? { totalBeds: totalCount } : {}),
      },
    },
    { new: true }
  );

  if (updatedRoom) {
    await syncRoomToKnowledge(updatedRoom);
  }

  return updatedRoom;
}

export async function syncPropertyMenuAndRulesToKnowledge(
  propertyOrId: IProperty | Types.ObjectId | string,
  options?: { forceReembed?: boolean }
): Promise<void> {
  const property =
    typeof propertyOrId === 'string' || propertyOrId instanceof Types.ObjectId
      ? await Property.findById(propertyOrId)
      : propertyOrId;

  if (!property) {
    return;
  }

  const timings = {
    breakfast: property.mealTimings?.breakfast || '7:30 AM – 9:45 AM',
    lunch: property.mealTimings?.lunch || '12:30 PM – 2:30 PM',
    dinner: property.mealTimings?.dinner || '7:45 PM – 10:00 PM',
  };

  // Sync each day's menu chunk
  for (const dayMenu of property.weeklyMenu) {
    const formatItems = (items: { name: string; dietary: string }[]) =>
      items.length > 0
        ? items.map((i) => `${i.name} [${i.dietary.toUpperCase()}]`).join('; ')
        : 'Not scheduled';

    const content = `${dayMenu.day} Menu at ${property.name}: Breakfast (${timings.breakfast}): ${formatItems(
      dayMenu.breakfast
    )}. Lunch (${timings.lunch}): ${formatItems(
      dayMenu.lunch
    )}. Dinner (${timings.dinner}): ${formatItems(dayMenu.dinner)}.`;

    await upsertKnowledgeDocument({
      sourceType: 'weekly_menu',
      sourceSection: `Weekly Menu — ${dayMenu.day}`,
      title: `${dayMenu.day} Dining Menu`,
      propertyId: property._id,
      category: 'food_menu',
      content,
      forceReembed: options?.forceReembed,
    });
  }

  // Sync live house rules & property details chunk
  const rules = property.houseRulesSummary;
  if (rules) {
    const addressLine = `${property.address.line1}, ${property.address.area}, ${property.address.city}, ${property.address.state} ${property.address.pincode}`;
    const mapsNote = property.googleMapsUrl ? ` Google Maps: ${property.googleMapsUrl}.` : '';
    const amenitiesNote =
      property.amenities.length > 0
        ? ` Property amenities: ${property.amenities.join(', ')}.`
        : '';
    const elecRate = property.electricityRatePerUnit ?? 9;

    const rulesContent = `${property.name} located at ${addressLine}.${mapsNote} Contact: ${property.contactPhone}, ${property.contactEmail}. Gender policy: ${property.genderPolicy}. Sub-meter electricity rate: ₹${elecRate}/unit. Curfew is ${rules.curfewTime}. Visitor hours are ${rules.visitorHours}. Overnight guest policy: ${rules.overnightGuestPolicy}. Quiet hours: ${rules.quietHours}. Smoking & alcohol policy: ${rules.smokingAlcoholPolicy}. Security deposit is refunded within ${rules.securityDepositRefundDays} working days of checkout inspection. GST rate on long-term residential stays is ${rules.gstRatePercent}%.${amenitiesNote}`;

    await upsertKnowledgeDocument({
      sourceType: 'house_rules',
      sourceSection: 'Property House Rules Summary (Live)',
      title: `${property.name} Live House Rules & Property Details`,
      propertyId: property._id,
      category: 'rules',
      content: rulesContent,
      forceReembed: options?.forceReembed,
    });
  }
}
