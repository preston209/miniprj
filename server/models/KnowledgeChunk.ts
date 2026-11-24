import mongoose, { Document, Model, Schema, Types } from 'mongoose';

export type KnowledgeSourceType =
  | 'house_rules'
  | 'policy'
  | 'neighborhood_guide'
  | 'room_inventory'
  | 'weekly_menu'
  | 'faq'
  | 'uploaded_doc';

export interface IKnowledgeMetadata {
  sourceType: KnowledgeSourceType;
  sourceSection: string;
  title: string;
  propertyId: Types.ObjectId;
  roomId?: Types.ObjectId | null;
  category?: string;
  updatedAt: Date;
}

export interface IKnowledgeChunk extends Document {
  _id: Types.ObjectId;
  content: string;
  embedding: number[];
  metadata: IKnowledgeMetadata;
  contentHash: string;
  chunkIndex: number;
  createdAt: Date;
  updatedAt: Date;
}

const KnowledgeMetadataSchema = new Schema<IKnowledgeMetadata>(
  {
    sourceType: {
      type: String,
      enum: [
        'house_rules',
        'policy',
        'neighborhood_guide',
        'room_inventory',
        'weekly_menu',
        'faq',
        'uploaded_doc',
      ],
      required: true,
      index: true,
    },
    sourceSection: {
      type: String,
      required: true,
      trim: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
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
    category: {
      type: String,
      trim: true,
    },
    updatedAt: {
      type: Date,
      default: Date.now,
    },
  },
  { _id: false }
);

const KnowledgeChunkSchema = new Schema<IKnowledgeChunk>(
  {
    content: {
      type: String,
      required: true,
      trim: true,
    },
    embedding: {
      type: [Number],
      required: true,
      validate: {
        validator: (arr: number[]) => Array.isArray(arr) && arr.length > 0,
        message: 'Embedding vector must be a non-empty numeric array',
      },
    },
    metadata: {
      type: KnowledgeMetadataSchema,
      required: true,
    },
    contentHash: {
      type: String,
      required: true,
      index: true,
    },
    chunkIndex: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: 'knowledge_chunks',
  }
);

KnowledgeChunkSchema.index({
  'metadata.propertyId': 1,
  'metadata.sourceType': 1,
  'metadata.roomId': 1,
});

export const KnowledgeChunk: Model<IKnowledgeChunk> =
  mongoose.models.KnowledgeChunk ||
  mongoose.model<IKnowledgeChunk>('KnowledgeChunk', KnowledgeChunkSchema);
