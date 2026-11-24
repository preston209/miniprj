import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type DietaryType = 'veg' | 'non-veg' | 'jain';
export type DayOfWeek =
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday'
  | 'Sunday';

export interface IMenuItem {
  name: string;
  dietary: DietaryType;
}

export interface IDailyMenu {
  day: DayOfWeek;
  breakfast: IMenuItem[];
  lunch: IMenuItem[];
  dinner: IMenuItem[];
}

export interface IProperty extends Document {
  _id: Types.ObjectId;
  name: string;
  slug: string;
  tagline: string;
  description: string;
  address: {
    line1: string;
    area: string;
    city: string;
    state: string;
    pincode: string;
    landmarks: string[];
  };
  contactPhone: string;
  contactEmail: string;
  genderPolicy: 'co-ed' | 'male-only' | 'female-only';
  amenities: string[];
  houseRulesSummary: {
    curfewTime: string;
    visitorHours: string;
    overnightGuestPolicy: string;
    quietHours: string;
    smokingAlcoholPolicy: string;
    securityDepositRefundDays: number;
    gstRatePercent: number;
  };
  weeklyMenu: IDailyMenu[];
  mealTimings?: {
    breakfast: string;
    lunch: string;
    dinner: string;
  };
  googleMapsUrl?: string;
  electricityRatePerUnit?: number;
  heroImageUrl?: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const MenuItemSchema = new Schema<IMenuItem>(
  {
    name: { type: String, required: true, trim: true },
    dietary: {
      type: String,
      enum: ['veg', 'non-veg', 'jain'],
      required: true,
    },
  },
  { _id: false }
);

const DailyMenuSchema = new Schema<IDailyMenu>(
  {
    day: {
      type: String,
      enum: [
        'Monday',
        'Tuesday',
        'Wednesday',
        'Thursday',
        'Friday',
        'Saturday',
        'Sunday',
      ],
      required: true,
    },
    breakfast: { type: [MenuItemSchema], default: [] },
    lunch: { type: [MenuItemSchema], default: [] },
    dinner: { type: [MenuItemSchema], default: [] },
  },
  { _id: false }
);

const PropertySchema = new Schema<IProperty>(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    tagline: {
      type: String,
      trim: true,
      maxlength: 200,
    },
    description: {
      type: String,
      required: true,
      trim: true,
    },
    address: {
      line1: { type: String, required: true, trim: true },
      area: { type: String, required: true, trim: true },
      city: { type: String, required: true, trim: true },
      state: { type: String, required: true, trim: true },
      pincode: { type: String, required: true, trim: true },
      landmarks: { type: [String], default: [] },
    },
    contactPhone: {
      type: String,
      required: true,
      trim: true,
    },
    contactEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    genderPolicy: {
      type: String,
      enum: ['co-ed', 'male-only', 'female-only'],
      default: 'co-ed',
    },
    amenities: {
      type: [String],
      default: [],
    },
    houseRulesSummary: {
      curfewTime: { type: String, default: '11:30 PM (Biometric late-entry pass available)' },
      visitorHours: { type: String, default: '9:00 AM – 8:00 PM in common lounge only' },
      overnightGuestPolicy: {
        type: String,
        default: 'Not permitted inside rooms; prior admin approval required for family emergencies',
      },
      quietHours: { type: String, default: '11:00 PM – 6:30 AM' },
      smokingAlcoholPolicy: {
        type: String,
        default: 'Strictly zero-tolerance inside rooms, corridors, and terrace',
      },
      securityDepositRefundDays: { type: Number, default: 7, min: 1 },
      gstRatePercent: { type: Number, default: 0, min: 0, max: 28 },
    },
    weeklyMenu: {
      type: [DailyMenuSchema],
      default: [],
    },
    mealTimings: {
      breakfast: { type: String, default: '7:30 AM – 9:45 AM', trim: true },
      lunch: { type: String, default: '12:30 PM – 2:30 PM', trim: true },
      dinner: { type: String, default: '7:45 PM – 10:00 PM', trim: true },
    },
    googleMapsUrl: {
      type: String,
      trim: true,
    },
    electricityRatePerUnit: {
      type: Number,
      default: 9,
      min: 0,
    },
    heroImageUrl: {
      type: String,
      trim: true,
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

PropertySchema.post('save', async function (doc) {
  if (process.env.SKIP_VECTOR_HOOKS === 'true') return;
  try {
    const { syncPropertyMenuAndRulesToKnowledge } = await import(
      '../services/knowledgeSyncService.ts'
    );
    await syncPropertyMenuAndRulesToKnowledge(doc);
  } catch (err) {
    console.error('[PropertyHook] Failed to sync menu/rules on save:', err);
  }
});

PropertySchema.post('findOneAndUpdate', async function (doc) {
  if (process.env.SKIP_VECTOR_HOOKS === 'true' || !doc) return;
  try {
    const { syncPropertyMenuAndRulesToKnowledge } = await import(
      '../services/knowledgeSyncService.ts'
    );
    await syncPropertyMenuAndRulesToKnowledge(doc);
  } catch (err) {
    console.error('[PropertyHook] Failed to sync menu/rules on update:', err);
  }
});

export const Property: Model<IProperty> =
  mongoose.models.Property || mongoose.model<IProperty>('Property', PropertySchema);
