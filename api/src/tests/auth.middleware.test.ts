import jwt from 'jsonwebtoken';
import { Response } from 'express';
import { requireAuth } from '../middleware/auth';
import { AuthedRequest, JwtPayload } from '../types';

function makeRes() {
  const res: Partial<Response> = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res as Response;
}

function signToken(payload: JwtPayload, expiresIn: string | number = '1h') {
  return jwt.sign(payload, process.env.JWT_SECRET as string, { expiresIn } as jwt.SignOptions);
}

describe('requireAuth — cookie and Bearer token paths', () => {
  it('authenticates via the cookie when present (existing browser-session behavior)', () => {
    const token = signToken({ userId: 'user1', role: 'admin' });
    const req = { cookies: { token }, headers: {} } as unknown as AuthedRequest;
    const res = makeRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ userId: 'user1', role: 'admin' });
  });

  it('authenticates via Authorization: Bearer when there is no cookie (the new MCP path)', () => {
    const token = signToken({ userId: 'service-account-id', role: 'manager' });
    const req = {
      cookies: {},
      headers: { authorization: `Bearer ${token}` },
    } as unknown as AuthedRequest;
    const res = makeRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(req.user).toMatchObject({ userId: 'service-account-id', role: 'manager' });
  });

  it('prefers the cookie over the Bearer header when both are present', () => {
    const cookieToken = signToken({ userId: 'cookie-user', role: 'staff' });
    const bearerToken = signToken({ userId: 'bearer-user', role: 'admin' });
    const req = {
      cookies: { token: cookieToken },
      headers: { authorization: `Bearer ${bearerToken}` },
    } as unknown as AuthedRequest;
    const res = makeRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(req.user?.userId).toBe('cookie-user');
  });

  it('rejects a malformed Authorization header (not "Bearer <token>")', () => {
    const req = {
      cookies: {},
      headers: { authorization: 'Basic somebase64' },
    } as unknown as AuthedRequest;
    const res = makeRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
  });

  it('rejects a valid-shape but wrong-secret Bearer token', () => {
    const token = jwt.sign({ userId: 'x', role: 'admin' }, 'wrong-secret');
    const req = {
      cookies: {},
      headers: { authorization: `Bearer ${token}` },
    } as unknown as AuthedRequest;
    const res = makeRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Invalid or expired session' });
  });

  it('rejects when neither cookie nor Bearer header is present', () => {
    const req = { cookies: {}, headers: {} } as unknown as AuthedRequest;
    const res = makeRes();
    const next = jest.fn();

    requireAuth(req, res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Not authenticated' });
  });
});
