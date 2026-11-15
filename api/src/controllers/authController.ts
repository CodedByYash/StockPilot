import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import type { SignOptions } from 'jsonwebtoken';
import { User } from '../models/User';
import { asyncHandler } from '../utils/asyncHandler';
import { AuthedRequest, JwtPayload } from '../types';

const JWT_SECRET = process.env.JWT_SECRET as string;
// jsonwebtoken's types want `expiresIn` as a number (seconds) or its own
// StringValue literal union, not a plain string — cast through unknown at
// the one place we read it from env, rather than loosening the signature.
const JWT_EXPIRES_IN = (process.env.JWT_EXPIRES_IN || '7d') as SignOptions['expiresIn'];

const registerSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  password: z.string().min(8),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function signToken(payload: JwtPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function setAuthCookie(res: Response, token: string) {
  res.cookie('token', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

// First registered user becomes admin; everyone after defaults to 'staff'
// and must be promoted by an admin. Prevents an open registration endpoint
// from letting anyone grant themselves admin access.
export const register = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = registerSchema.parse(req.body);

  const existing = await User.findOne({ email: body.email });
  if (existing) {
    return res.status(409).json({ error: 'Email already registered' });
  }

  const userCount = await User.countDocuments();
  const role = userCount === 0 ? 'admin' : 'staff';

  const passwordHash = await bcrypt.hash(body.password, 10);
  const user = await User.create({ ...body, passwordHash, role });

  const token = signToken({ userId: user._id.toString(), role: user.role });
  setAuthCookie(res, token);

  res.status(201).json({ user });
});

export const login = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const body = loginSchema.parse(req.body);

  const user = await User.findOne({ email: body.email });
  if (!user || !user.isActive) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const valid = await user.comparePassword(body.password);
  if (!valid) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const token = signToken({ userId: user._id.toString(), role: user.role });
  setAuthCookie(res, token);

  res.json({ user });
});

export const logout = asyncHandler(async (_req: AuthedRequest, res: Response) => {
  res.clearCookie('token');
  res.status(204).send();
});

export const me = asyncHandler(async (req: AuthedRequest, res: Response) => {
  const user = await User.findById(req.user?.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  res.json({ user });
});
