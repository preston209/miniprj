import crypto from 'crypto';
import type { NextFunction, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import { User, type IUser, type UserRole } from '../models/User.ts';

export const AUTH_COOKIE_NAME = 'havenstay_token';
const TOKEN_TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

// Read JWT_SECRET from env or generate an ephemeral CSPRNG secret in memory for dev preview
const EPHEMERAL_JWT_SECRET = crypto.randomBytes(32).toString('hex');

function getJwtSecret(): string {
  return process.env.JWT_SECRET && process.env.JWT_SECRET.trim().length >= 16
    ? process.env.JWT_SECRET
    : EPHEMERAL_JWT_SECRET;
}

export interface JwtPayload {
  sub: string;
  role: UserRole;
  email: string;
}

export interface AuthenticatedRequest extends Request {
  user?: IUser;
  authSource?: 'cookie' | 'bearer';
}

export function signAuthToken(user: {
  _id: { toString(): string };
  role: UserRole;
  email: string;
}): string {
  const payload: JwtPayload = {
    sub: user._id.toString(),
    role: user.role,
    email: user.email,
  };
  return jwt.sign(payload, getJwtSecret(), { expiresIn: TOKEN_TTL_SECONDS });
}

export function setAuthCookie(res: Response, token: string): void {
  // Emit HttpOnly; Secure; SameSite=None; Partitioned for cross-origin iframe preview compatibility
  const cookieDirectives = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(token)}`,
    'Path=/',
    `Max-Age=${TOKEN_TTL_SECONDS}`,
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
  ];
  res.append('Set-Cookie', cookieDirectives.join('; '));
}

export function clearAuthCookie(res: Response): void {
  const cookieDirectives = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'Max-Age=0',
    'HttpOnly',
    'Secure',
    'SameSite=None',
    'Partitioned',
  ];
  res.append('Set-Cookie', cookieDirectives.join('; '));
}

function extractToken(req: Request): { token: string | null; source?: 'cookie' | 'bearer' } {
  const authHeader = req.headers.authorization;
  if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
    return { token: authHeader.slice(7).trim(), source: 'bearer' };
  }

  const cookieToken = req.cookies?.[AUTH_COOKIE_NAME];
  if (typeof cookieToken === 'string' && cookieToken.trim().length > 0) {
    return { token: cookieToken, source: 'cookie' };
  }

  return { token: null };
}

function isSameOriginMutationAllowed(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  // Custom header check mitigates cross-site form submissions
  if (req.headers['x-requested-with'] === 'XMLHttpRequest') {
    return true;
  }

  const expectedHost =
    (typeof req.headers['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host']) ||
    req.headers.host;

  if (!expectedHost) {
    return false;
  }

  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin.length > 0) {
    try {
      const originHost = new URL(origin).host;
      return originHost === expectedHost;
    } catch {
      return false;
    }
  }

  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer.length > 0) {
    try {
      const refererHost = new URL(referer).host;
      return refererHost === expectedHost;
    } catch {
      return false;
    }
  }

  // Allow non-browser API clients (e.g. curl) that do not send Origin/Referer headers
  return true;
}

export async function optionalAuth(
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> {
  const { token, source } = extractToken(req);
  if (!token) {
    next();
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    const user = await User.findById(decoded.sub);
    if (user) {
      req.user = user;
      req.authSource = source;
    }
  } catch {
    // Invalid or expired token treated as unauthenticated in optionalAuth
  }
  next();
}

export async function requireAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const { token, source } = extractToken(req);
  if (!token) {
    res.status(401).json({ error: 'Authentication required. Please sign in.' });
    return;
  }

  if (source === 'cookie' && !isSameOriginMutationAllowed(req)) {
    res.status(403).json({ error: 'Origin verification failed for state-changing request.' });
    return;
  }

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as JwtPayload;
    const user = await User.findById(decoded.sub);
    if (!user) {
      res.status(401).json({ error: 'Session user no longer exists.' });
      return;
    }
    req.user = user;
    req.authSource = source;
    next();
  } catch {
    res.status(401).json({ error: 'Invalid or expired authentication session.' });
  }
}

export function requireRole(...allowedRoles: UserRole[]) {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        error: `Access denied. Required role: ${allowedRoles.join(' or ')}.`,
      });
      return;
    }
    next();
  };
}
