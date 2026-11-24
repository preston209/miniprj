import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type BookingType = 'tour' | 'reservation' | 'invoice';
export type TourMode = 'physical' | 'virtual';
export type BookingStatus =
  | 'pending'
  | 'confirmed'
  | 'completed'
  | 'converted_to_resident'
  | 'cancelled'
  | 'checked_in';
export type PaymentStatus = 'unpaid' | 'paid' | 'overdue' | 'waived';

export interface IBooking extends Document {
  _id: Types.ObjectId;
  bookingType: BookingType;
  propertyId: Types.ObjectId;
  roomId?: Types.ObjectId | null;
  bedId?: Types.ObjectId | null;
  userId?: Types.ObjectId | null;

  // Tour Scheduling fields
  tourMode?: TourMode;
  tourSlotDate?: Date | null;
  tourSlotTime?: string;
  leadName?: string;
  leadEmail?: string;
  leadPhone?: string;
  sharingPreference?: 'single' | 'double' | 'triple';
  moveInTimeline?: string;

  // Reservation & Stay fields
  moveInDate?: Date | null;
  monthlyRent?: number;
  securityDeposit?: number;
  status: BookingStatus;

  // Monthly Rent & Utility Invoice fields
  billingMonth?: string; // e.g., '2026-11'
  baseRent?: number;
  securityDepositCharge?: number;
  electricityUnits?: number;
  electricityCharge?: number;
  mealDeduction?: number;
  gstAmount?: number;
  totalAmount?: number;
  paymentStatus?: PaymentStatus;
  paymentGateway?: 'razorpay_mock' | 'stripe_mock' | 'upi' | 'bank_transfer';
  transactionId?: string;
  paidAt?: Date | null;
  receiptNumber?: string;
  hraEligible?: boolean;

  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

const BookingSchema = new Schema<IBooking>(
  {
    bookingType: {
      type: String,
      enum: ['tour', 'reservation', 'invoice'],
      required: true,
      index: true,
    },
    propertyId: {
      type: Schema.Types.ObjectId,
      ref: 'Property',
      required: true,
      index: true,
    },
    roomId: {
      type: Schema.Types.ObjectId,
      ref: 'Room',
      default: null,
    },
    bedId: {
      type: Schema.Types.ObjectId,
      ref: 'Bed',
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      default: null,
      index: true,
    },

    // Tour fields
    tourMode: {
      type: String,
      enum: ['physical', 'virtual'],
    },
    tourSlotDate: {
      type: Date,
      default: null,
    },
    tourSlotTime: {
      type: String,
      trim: true,
    },
    leadName: {
      type: String,
      trim: true,
      maxlength: 100,
    },
    leadEmail: {
      type: String,
      lowercase: true,
      trim: true,
    },
    leadPhone: {
      type: String,
      trim: true,
    },
    sharingPreference: {
      type: String,
      enum: ['single', 'double', 'triple'],
    },
    moveInTimeline: {
      type: String,
      trim: true,
    },

    // Reservation fields
    moveInDate: {
      type: Date,
      default: null,
    },
    monthlyRent: {
      type: Number,
      min: 0,
    },
    securityDeposit: {
      type: Number,
      min: 0,
    },
    status: {
      type: String,
      enum: [
        'pending',
        'confirmed',
        'completed',
        'converted_to_resident',
        'cancelled',
        'checked_in',
      ],
      default: 'pending',
      index: true,
    },

    // Invoice fields
    billingMonth: {
      type: String,
      match: /^\d{4}-\d{2}$/,
      index: true,
    },
    baseRent: {
      type: Number,
      min: 0,
    },
    securityDepositCharge: {
      type: Number,
      min: 0,
      default: 0,
    },
    electricityUnits: {
      type: Number,
      min: 0,
    },
    electricityCharge: {
      type: Number,
      min: 0,
    },
    mealDeduction: {
      type: Number,
      min: 0,
      default: 0,
    },
    gstAmount: {
      type: Number,
      min: 0,
      default: 0,
    },
    totalAmount: {
      type: Number,
      min: 0,
    },
    paymentStatus: {
      type: String,
      enum: ['unpaid', 'paid', 'overdue', 'waived'],
      default: 'unpaid',
      index: true,
    },
    paymentGateway: {
      type: String,
      enum: ['razorpay_mock', 'stripe_mock', 'upi', 'bank_transfer'],
    },
    transactionId: {
      type: String,
      trim: true,
    },
    paidAt: {
      type: Date,
      default: null,
    },
    receiptNumber: {
      type: String,
      trim: true,
    },
    hraEligible: {
      type: Boolean,
      default: true,
    },

    notes: {
      type: String,
      trim: true,
      maxlength: 500,
    },
  },
  {
    timestamps: true,
  }
);

BookingSchema.index({ userId: 1, bookingType: 1, billingMonth: 1 });

export const Booking: Model<IBooking> =
  mongoose.models.Booking || mongoose.model<IBooking>('Booking', BookingSchema);
