import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import type { User } from '../types/index.js';

const SESSION_COOKIE_NAME = 'challenge_session';
const SESSION_MAX_AGE_MS = 1000 * 60 * 60 * 24 * 30; // 30 days
const ENV_SESSION_SECRET = process.env.SESSION_SECRET?.trim();
const SESSION_SECRET = ENV_SESSION_SECRET || crypto.randomBytes(32).toString('hex');

if (!ENV_SESSION_SECRET && (process.env.NODE_ENV === 'production' || process.env.VERCEL)) {
  console.warn(
    '[Auth Warning] SESSION_SECRET environment variable is not set. Serverless instances will not share session signing keys across cold starts.'
  );
}

export function isSessionSecretConfigured(): boolean {
  return Boolean(ENV_SESSION_SECRET);
}

export interface AuthenticatedRequest extends Request {
  user?: User;
  authMethod?: 'bearer' | 'cookie';
}

export function sanitizeUser(user: User) {
  return {
    id: user.id,
    email: user.email,
    fullName: user.fullName,
    role: user.role,
    isActive: user.isActive,
    enrollmentDate: user.enrollmentDate,
    xp: user.xp,
    streakDays: user.streakDays,
    lastActiveAt: user.lastActiveAt,
    requiresPasswordChange: user.requiresPasswordChange,
    badges: user.badges,
    cohort: user.cohort,
    cohortId: user.cohortId,
    grantFullAccess: Boolean(user.grantFullAccess),
  };
}

export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  return `${salt}:${hash}`;
}

export function verifyPassword(password: string, storedHash: string): boolean {
  try {
    const [salt, key] = storedHash.split(':');
    if (!salt || !key) return false;
    const keyBuffer = Buffer.from(key, 'hex');
    const derivedKey = crypto.scryptSync(password, salt, 64);
    if (keyBuffer.length !== derivedKey.length) return false;
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch {
    return false;
  }
}

export function generateToken(payload: { userId: string; role: string; email: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + SESSION_MAX_AGE_MS;
  const body = Buffer.from(JSON.stringify({ ...payload, exp })).toString('base64url');
  const signature = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(`${header}.${body}`)
    .digest('base64url');
  return `${header}.${body}.${signature}`;
}

export function verifyToken(token: string): { userId: string; role: string; email: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return null;
    const [header, body, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', SESSION_SECRET)
      .update(`${header}.${body}`)
      .digest('base64url');

    const sigBuf = Buffer.from(signature);
    const expectedBuf = Buffer.from(expectedSig);
    if (sigBuf.length !== expectedBuf.length || !crypto.timingSafeEqual(sigBuf, expectedBuf)) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null;
    }
    return payload;
  } catch {
    return null;
  }
}

function isSecureRequest(req: Request): boolean {
  const proto = req.headers['x-forwarded-proto'];
  if (typeof proto === 'string') {
    return proto.split(',')[0].trim().toLowerCase() === 'https';
  }
  return Boolean(req.secure || process.env.VERCEL);
}

export function setSessionCookie(req: Request, res: Response, token: string): void {
  const secure = isSecureRequest(req);
  if (secure) {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
      maxAge: SESSION_MAX_AGE_MS,
    } as any);
  } else {
    res.cookie(SESSION_COOKIE_NAME, token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE_MS,
    });
  }
}

export function clearSessionCookie(req: Request, res: Response): void {
  const secure = isSecureRequest(req);
  if (secure) {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: true,
      sameSite: 'none',
      partitioned: true,
      path: '/',
    } as any);
  } else {
    res.clearCookie(SESSION_COOKIE_NAME, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
    });
  }
}

function extractCookieToken(req: Request): string | null {
  const rawCookie = req.headers.cookie;
  if (!rawCookie) return null;
  const pairs = rawCookie.split(';');
  for (const pair of pairs) {
    const eqIdx = pair.indexOf('=');
    if (eqIdx === -1) continue;
    const key = pair.slice(0, eqIdx).trim();
    if (key === SESSION_COOKIE_NAME) {
      const value = pair.slice(eqIdx + 1).trim();
      return decodeURIComponent(value);
    }
  }
  return null;
}

function isSameOriginForCookieMutation(req: Request): boolean {
  const method = req.method.toUpperCase();
  if (method === 'GET' || method === 'HEAD' || method === 'OPTIONS') {
    return true;
  }

  const expectedHost = (
    (typeof req.headers['x-forwarded-host'] === 'string' && req.headers['x-forwarded-host'].split(',')[0].trim()) ||
    req.headers.host ||
    ''
  ).toLowerCase();

  const origin = req.headers.origin;
  if (typeof origin === 'string' && origin) {
    try {
      const parsed = new URL(origin);
      return Boolean(expectedHost && parsed.host.toLowerCase() === expectedHost);
    } catch {
      return false;
    }
  }

  // Fallback to custom CSRF header or Referer if Origin header is omitted
  if (req.headers['x-requested-with']) {
    return true;
  }

  const referer = req.headers.referer;
  if (typeof referer === 'string' && referer) {
    try {
      const parsed = new URL(referer);
      return Boolean(expectedHost && parsed.host.toLowerCase() === expectedHost);
    } catch {
      return false;
    }
  }

  return true;
}

export function generateTemporaryPassword(): string {
  const n1 = crypto.randomInt(1000, 9999);
  const n2 = crypto.randomInt(1000, 9999);
  return `Skill-${n1}-${n2}`;
}

export function generateInviteToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Authentication Middleware:
 * Supports HttpOnly session cookies and Bearer tokens, verifies DB account status,
 * enforces origin matching for cookie-authenticated mutations, and blocks inactive users.
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    let token: string | null = null;
    let authMethod: 'bearer' | 'cookie' = 'cookie';

    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.substring(7).trim();
      authMethod = 'bearer';
    } else {
      token = extractCookieToken(req);
      authMethod = 'cookie';
    }

    if (!token) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    if (authMethod === 'cookie' && !isSameOriginForCookieMutation(req)) {
      res.status(403).json({ error: 'Cross-origin request rejected.' });
      return;
    }

    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      if (authMethod === 'cookie') {
        clearSessionCookie(req, res);
      }
      res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      return;
    }

    const user = await db.getUserById(payload.userId);
    if (!user) {
      if (authMethod === 'cookie') {
        clearSessionCookie(req, res);
      }
      res.status(401).json({ error: 'Account not found.' });
      return;
    }

    if (!user.isActive) {
      res.status(403).json({
        error: 'Account deactivated. Your access to the 1 Million Naira Skill Challenge has been suspended. Please contact the administrator.',
        deactivated: true,
      });
      return;
    }

    req.user = user;
    req.authMethod = authMethod;
    next();
  } catch (err: any) {
    res.status(500).json({ error: err?.message || 'Authentication check failed.' });
  }
}

/**
 * Admin Authorization Middleware:
 * Re-validates that the authenticated user strictly holds the 'admin' role in DB.
 */
export function requireAdmin(req: AuthenticatedRequest, res: Response, next: NextFunction): void {
  if (!req.user || req.user.role !== 'admin') {
    res.status(403).json({ error: 'Access denied. Administrative privileges are required.' });
    return;
  }
  next();
}
