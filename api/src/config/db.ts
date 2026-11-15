import mongoose from 'mongoose';

export async function connectDB(uri: string): Promise<void> {
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(uri);
    console.log(`[db] connected -> ${mongoose.connection.name}`);
  } catch (err) {
    console.error('[db] connection failed', err);
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('[db] disconnected');
  });
}

export async function disconnectDB(): Promise<void> {
  await mongoose.disconnect();
}

let connecting: Promise<unknown> | null = null;

/**
 * Serverless-safe connection helper (used by the Vercel entry point).
 * Unlike connectDB(), this never calls process.exit — a failed connect
 * rejects so the request gets a 500 and the next invocation can retry.
 * The in-flight promise is cached at module scope so a warm function
 * instance reuses one connection instead of opening a new one per request.
 */
export async function ensureDB(uri: string): Promise<void> {
  if (mongoose.connection.readyState === 1) return;
  if (!connecting) {
    mongoose.set('strictQuery', true);
    connecting = mongoose.connect(uri, { maxPoolSize: 5 }).catch((err) => {
      connecting = null;
      throw err;
    });
  }
  await connecting;
}
