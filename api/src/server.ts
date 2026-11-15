import dotenv from 'dotenv';
dotenv.config();

import { createApp } from './app';
import { connectDB } from './config/db';
import { startLowStockCron } from './jobs/lowStockCheck';
import { startReorderCron } from './jobs/reorderCheck';

const PORT = process.env.PORT || 4000;
const MONGO_URI = process.env.MONGO_URI as string;

async function main() {
  if (!MONGO_URI) {
    throw new Error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  }

  await connectDB(MONGO_URI);

  const app = createApp();
  app.listen(PORT, () => {
    console.log(`[server] listening on http://localhost:${PORT}`);
  });

  startLowStockCron();
  startReorderCron();
}

main().catch((err) => {
  console.error('[server] failed to start', err);
  process.exit(1);
});
