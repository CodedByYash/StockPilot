/* eslint-disable no-console */
import dotenv from 'dotenv';
dotenv.config();

import crypto from 'crypto';
import jwt, { SignOptions } from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { connectDB, disconnectDB } from '../config/db';
import { User } from '../models/User';

const JWT_SECRET = process.env.JWT_SECRET as string;
const SERVICE_EMAIL = 'mcp-service@internal';

/**
 * Creates (or reuses, if it already exists) a non-interactive service
 * account and prints a JWT for it. This is what the MCP server
 * authenticates as — there's no browser session to hold a cookie, so it
 * sends this token as `Authorization: Bearer <token>` on every request
 * (see api/src/middleware/auth.ts for the corresponding accept-side change,
 * and mcp-server/src/apiClient.ts for where this token gets used).
 *
 * Deliberately separate from scripts/seed.ts: seed.ts wipes and
 * regenerates demo data every run, which would silently invalidate
 * whatever token you'd already put in mcp-server/.env. Run this once,
 * independent of how often you reseed demo data.
 *
 * Role is 'manager' — enough to read everything and create/receive POs,
 * fulfill SOs, and record stock movements, but not manage users or
 * warehouses. Tighten or loosen by editing the role below if your tool
 * set needs differ.
 *
 * Usage:
 *   npm run create-service-account              # 1 year expiry (default)
 *   npm run create-service-account -- 90d        # custom expiry
 */
async function main() {
  const uri = process.env.MONGO_URI as string;
  if (!uri) throw new Error('MONGO_URI is not set. Copy .env.example to .env and fill it in.');
  if (!JWT_SECRET) throw new Error('JWT_SECRET is not set.');

  const expiresIn = (process.argv[2] || '365d') as SignOptions['expiresIn'];

  await connectDB(uri);

  let user = await User.findOne({ email: SERVICE_EMAIL });
  if (!user) {
    // Random password the account will never actually use to log in —
    // required by the schema, never exposed, never needed since this
    // account only ever authenticates via the minted JWT below.
    const passwordHash = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
    user = await User.create({
      name: 'MCP Service Account',
      email: SERVICE_EMAIL,
      passwordHash,
      role: 'manager',
    });
    console.log(`[service-account] created ${SERVICE_EMAIL} (role: manager)`);
  } else {
    console.log(`[service-account] reusing existing ${SERVICE_EMAIL} (role: ${user.role})`);
  }

  const token = jwt.sign({ userId: user._id.toString(), role: user.role }, JWT_SECRET, { expiresIn });

  console.log('\n[service-account] token (expires in', expiresIn + '):\n');
  console.log(token);
  console.log('\nPut this in mcp-server/.env as MCP_SERVICE_TOKEN.\n');

  await disconnectDB();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
