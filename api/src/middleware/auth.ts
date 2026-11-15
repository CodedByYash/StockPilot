import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthedRequest, JwtPayload, Role } from '../types';

const JWT_SECRET = process.env.JWT_SECRET as string;

export function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const cookieToken = req.cookies?.token as string | undefined;

  // Browser sessions use the httpOnly cookie. Non-browser callers — the
  // MCP server being the first of these — have no cookie jar, so they
  // authenticate with a normal JWT in an Authorization: Bearer header
  // instead. Same JWT_SECRET, same verification, same req.user shape
  // either way; everything downstream (requireRole, controllers) treats
  // both identically and neither knows which one was used.
  const authHeader = req.headers.authorization;
  const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length) : undefined;

  const token = cookieToken ?? bearerToken;

  if (!token) {
    return res.status(401).json({ error: 'Not authenticated' });
  }

  try {
    const payload = jwt.verify(token, JWT_SECRET) as JwtPayload;
    req.user = payload;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired session' });
  }
}

/** Usage: router.post('/', requireAuth, requireRole('admin', 'manager'), handler) */
export function requireRole(...allowed: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Not authenticated' });
    }
    if (!allowed.includes(req.user.role)) {
      return res.status(403).json({ error: 'Insufficient permissions' });
    }
    next();
  };
}
