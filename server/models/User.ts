import bcrypt from 'bcryptjs';
import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type UserRole = 'guest' | 'resident' | 'admin';
export type GenderType = 'male' | 'female' | 'other';
export type MealSlot = 'breakfast' | 'lunch' | 'dinner';

export interface IMealOptOut {
  date: string; // YYYY-MM-DD
  meals: MealSlot[];
}

export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  phone: string;
  passwordHash: string;
  role: UserRole;
  gender: GenderType;
  occupation?: string;
  emergencyContact?: {
    name: string;
    phone: string;
    relation: string;
  };
  kycVerified: boolean;
  assignedPropertyId?: Types.ObjectId | null;
  assignedRoomId?: Types.ObjectId | null;
  assignedBedId?: Types.ObjectId | null;
  checkInDate?: Date | null;
  noticeEndDate?: Date | null;
  mealOptOuts: IMealOptOut[];
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const MealOptOutSchema = new Schema<IMealOptOut>(
  {
    date: {
      type: String,
      required: true,
      match: /^\d{4}-\d{2}-\d{2}$/,
    },
    meals: [
      {
        type: String,
        enum: ['breakfast', 'lunch', 'dinner'],
      },
    ],
  },
  { _id: false }
);

const UserSchema = new Schema<IUser>(
  {
    name: {
      type: String,
      required: [true, 'Full name is required'],
      trim: true,
      minlength: 2,
      maxlength: 100,
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email address'],
    },
    phone: {
      type: String,
      required: [true, 'Phone number is required'],
      trim: true,
      maxlength: 20,
    },
    passwordHash: {
      type: String,
      required: true,
      select: false,
    },
    role: {
      type: String,
      enum: ['guest', 'resident', 'admin'],
      default: 'guest',
      index: true,
    },
    gender: {
      type: String,
      enum: ['male', 'female', 'other'],
      default: 'male',
    },
    occupation: {
      type: String,
      trim: true,
      maxlength: 120,
    },
    emergencyContact: {
      name: { type: String, trim: true },
      phone: { type: String, trim: true },
      relation: { type: String, trim: true },
    },
    kycVerified: {
      type: Boolean,
      default: false,
    },
    assignedPropertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      default: null,
    },
    assignedRoomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    assignedBedId: {
      type: Schema.Types.ObjectId,
      ref: 'Bed',
      default: null,
    },
    checkInDate: {
      type: Date,
      default: null,
    },
    noticeEndDate: {
      type: Date,
      default: null,
    },
    mealOptOuts: {
      type: [MealOptOutSchema],
      default: [],
    },
  },
  {
    timestamps: true,
  }
);

UserSchema.pre('save', async function () {
  if (!this.isModified('passwordHash')) {
    return;
  }
  // Avoid double-hashing if a bcrypt hash is already stored
  if (/^\$2[aby]\$\d{2}\$/.test(this.passwordHash)) {
    return;
  }
  const salt = await bcrypt.genSalt(12);
  this.passwordHash = await bcrypt.hash(this.passwordHash, salt);
});

UserSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.passwordHash);
};

export const User: Model<IUser> =
  mongoose.models.User || mongoose.model<IUser>('User', UserSchema);
