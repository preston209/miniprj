import mongoose from 'mongoose';

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
  lastFailureAt: number;
  lastErrorMessage: string | null;
}

declare global {
  // eslint-disable-next-line no-var
  var __mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = globalThis.__mongooseCache ?? {
  conn: null,
  promise: null,
  lastFailureAt: 0,
  lastErrorMessage: null,
};

globalThis.__mongooseCache = cached;

const RETRY_COOLDOWN_MS = 15_000;

function isPlaceholderUri(uri: string): boolean {
  return (
    uri.includes('<username>') ||
    uri.includes('<password>') ||
    uri.includes('<cluster>')
  );
}

export function getLastDbError(): string | null {
  return cached.lastErrorMessage;
}

export async function connectDB(): Promise<typeof mongoose> {
  if (cached.conn && mongoose.connection.readyState === 1) {
    return cached.conn;
  }

  const uri = process.env.MONGODB_URI;
  if (!uri || isPlaceholderUri(uri)) {
    const msg =
      'MONGODB_URI is not configured with a live MongoDB connection string.';
    cached.lastErrorMessage = msg;
    throw new Error(msg);
  }

  // Fail fast during cooldown window so UI doesn't stall repeatedly on unreachable Atlas IP
  if (
    cached.lastFailureAt > 0 &&
    Date.now() - cached.lastFailureAt < RETRY_COOLDOWN_MS
  ) {
    throw new Error(
      cached.lastErrorMessage ??
        'MongoDB cluster temporarily unreachable. Verify MONGODB_URI and Atlas IP whitelist (0.0.0.0/0).'
    );
  }

  if (!cached.promise) {
    mongoose.set('strictQuery', true);
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      maxPoolSize: 10,
      serverSelectionTimeoutMS: 4000,
    });
  }

  try {
    cached.conn = await cached.promise;
    cached.lastFailureAt = 0;
    cached.lastErrorMessage = null;
  } catch (err) {
    cached.promise = null;
    cached.conn = null;
    cached.lastFailureAt = Date.now();
    const rawMsg = err instanceof Error ? err.message : 'Unable to connect to MongoDB.';
    cached.lastErrorMessage = rawMsg.includes('whitelist') || rawMsg.includes('Could not connect')
      ? 'MongoDB Atlas unreachable — ensure 0.0.0.0/0 is allowed in Atlas Network Access and MONGODB_URI is valid.'
      : rawMsg;
    console.warn(`[DB] ${cached.lastErrorMessage}`);
    throw new Error(cached.lastErrorMessage);
  }

  return cached.conn;
}

export async function disconnectDB(): Promise<void> {
  if (cached.conn) {
    await mongoose.disconnect();
    cached.conn = null;
    cached.promise = null;
  }
}
