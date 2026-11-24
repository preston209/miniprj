import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type BedStatus =
  | 'available'
  | 'occupied'
  | 'notice_period'
  | 'reserved'
  | 'maintenance';

export interface IBed extends Document {
  _id: Types.ObjectId;
  propertyId: Types.ObjectId;
  roomId: Types.ObjectId;
  bedCode: string;
  status: BedStatus;
  currentTenantId?: Types.ObjectId | null;
  checkInDate?: Date | null;
  noticeGivenDate?: Date | null;
  expectedVacateDate?: Date | null;
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BedSchema = new Schema<IBed>(
  {
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      required: true,
      index: true,
    },
    bedCode: {
      type: String,
      required: true,
      trim: true,
      uppercase: true,
    },
    status: {
      type: String,
      enum: ['available', 'occupied', 'notice_period', 'reserved', 'maintenance'],
      default: 'available',
      required: true,
      index: true,
    },
    currentTenantId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
    },
    checkInDate: {
      type: Date,
      default: null,
    },
    noticeGivenDate: {
      type: Date,
      default: null,
    },
    expectedVacateDate: {
      type: Date,
      default: null,
    },
    notes: {
      type: String,
      trim: true,
      maxlength: 300,
    },
  },
  {
    timestamps: true,
  }
);

BedSchema.index({ roomId: 1, bedCode: 1 }, { unique: true });

BedSchema.post('save', async function (doc) {
  if (process.env.SKIP_VECTOR_HOOKS === 'true') return;
  try {
    const { recalculateRoomVacancy } = await import('../services/knowledgeSyncService.ts');
    await recalculateRoomVacancy(doc.roomId);
  } catch (err) {
    console.error('[BedHook] Failed to recalculate room vacancy on save:', err);
  }
});

BedSchema.post('findOneAndUpdate', async function (doc) {
  if (process.env.SKIP_VECTOR_HOOKS === 'true' || !doc) return;
  try {
    const { recalculateRoomVacancy } = await import('../services/knowledgeSyncService.ts');
    await recalculateRoomVacancy(doc.roomId);
  } catch (err) {
    console.error('[BedHook] Failed to recalculate room vacancy on update:', err);
  }
});

export const Bed: Model<IBed> =
  mongoose.models.Bed || mongoose.model<IBed>('Bed', BedSchema);
