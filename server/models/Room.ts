import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type SharingType = 'single' | 'double' | 'triple';
export type GenderPreference = 'male' | 'female' | 'any';

export interface IRoom extends Document {
  _id: Types.ObjectId;
  propertyId: Types.ObjectId;
  roomNumber: string;
  floor: number;
  sharingType: SharingType;
  isAC: boolean;
  genderPreference: GenderPreference;
  monthlyRent: number;
  securityDeposit: number;
  lockInMonths: number;
  noticePeriodDays: number;
  electricityRatePerUnit: number;
  estimatedMonthlyElectricity: number;
  amenities: string[];
  totalBeds: number;
  vacantBedsCount: number;
  imageUrl?: string;
  description?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const RoomSchema = new Schema<IRoom>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    roomNumber: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    floor: {
      type: Number,
      required: true,
      min: 0,
      max: 50,
    },
    sharingType: {
      type: String,
      enum: ['single', 'double', 'triple'],
      required: true,
      index: true,
    },
    isAC: {
      type: Boolean,
      required: true,
      default: false,
      index: true,
    },
    genderPreference: {
      type: String,
      enum: ['male', 'female', 'any'],
      required: true,
      default: 'any',
      index: true,
    },
    monthlyRent: {
      type: Number,
      required: true,
      min: 1000,
    },
    securityDeposit: {
      type: Number,
      required: true,
      min: 0,
    },
    lockInMonths: {
      type: Number,
      required: true,
      default: 2,
      min: 0,
      max: 24,
    },
    noticePeriodDays: {
      type: Number,
      required: true,
      default: 30,
      min: 7,
      max: 90,
    },
    electricityRatePerUnit: {
      type: Number,
      required: true,
      default: 9,
      min: 0,
    },
    estimatedMonthlyElectricity: {
      type: Number,
      required: true,
      default: 900,
      min: 0,
    },
    amenities: {
      type: [String],
      default: [],
    },
    totalBeds: {
      type: Number,
      required: true,
      min: 1,
      max: 6,
    },
    vacantBedsCount: {
      type: Number,
      required: true,
      min: 0,
      max: 6,
      index: true,
    },
    imageUrl: {
      type: String,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
      maxlength: 500,
    },
    isActive: {
      type: Boolean,
      default: true,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

RoomSchema.index({ propertyId: 1, roomNumber: 1 }, { unique: true });

RoomSchema.post('save', async function (doc) {
  if (process.env.SKIP_VECTOR_HOOKS === 'true') return;
  try {
    const { syncRoomToKnowledge } = await import('../services/knowledgeSyncService.ts');
    await syncRoomToKnowledge(doc);
  } catch (err) {
    console.error('[RoomHook] Failed to sync room knowledge chunk on save:', err);
  }
});

RoomSchema.post('findOneAndUpdate', async function (doc) {
  if (process.env.SKIP_VECTOR_HOOKS === 'true' || !doc) return;
  try {
    const { syncRoomToKnowledge } = await import('../services/knowledgeSyncService.ts');
    await syncRoomToKnowledge(doc);
  } catch (err) {
    console.error('[RoomHook] Failed to sync room knowledge chunk on update:', err);
  }
});

export const Room: Model<IRoom> =
  mongoose.models.Room || mongoose.model<IRoom>('Room', RoomSchema);
