import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type TicketCategory =
  | 'Wi-Fi'
  | 'Plumbing'
  | 'Housekeeping'
  | 'AC'
  | 'Electrical'
  | 'Other';
export type TicketPriority = 'low' | 'medium' | 'high' | 'urgent';
export type TicketStatus = 'Open' | 'In Progress' | 'Resolved';

export interface ITicket extends Document {
  _id: Types.ObjectId;
  propertyId: Types.ObjectId;
  roomId?: Types.ObjectId | null;
  residentId: Types.ObjectId;
  category: TicketCategory;
  title: string;
  description: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignedStaff?: string;
  resolutionNotes?: string;
  resolvedAt?: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

const TicketSchema = new Schema<ITicket>(
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
      default: null,
    },
    residentId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    category: {
      type: String,
      enum: ['Wi-Fi', 'Plumbing', 'Housekeeping', 'AC', 'Electrical', 'Other'],
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
      minlength: 4,
      maxlength: 140,
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 1500,
    },
    priority: {
      type: String,
      enum: ['low', 'medium', 'high', 'urgent'],
      default: 'medium',
      index: true,
    },
    status: {
      type: String,
      enum: ['Open', 'In Progress', 'Resolved'],
      default: 'Open',
      index: true,
    },
    assignedStaff: {
      type: String,
      trim: true,
    },
    resolutionNotes: {
      type: String,
      trim: true,
      maxlength: 1000,
    },
    resolvedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Ticket: Model<ITicket> =
  mongoose.models.Ticket || mongoose.model<ITicket>('Ticket', TicketSchema);
