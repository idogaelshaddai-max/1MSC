import crypto from 'node:crypto';
import type { Request, Response, NextFunction } from 'express';
import { db } from './db.js';
import type { User } from '../types/index.js';

// Server-side persistent secret
const SESSION_SECRET = process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex');

export interface AuthenticatedRequest extends Request {
  user?: User;
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
    return crypto.timingSafeEqual(keyBuffer, derivedKey);
  } catch (err) {
    return false;
  }
}

export function generateToken(payload: { userId: string; role: string; email: string }): string {
  const header = Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url');
  const exp = Date.now() + 1000 * 60 * 60 * 24 * 30; // 30 days
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

    if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSig))) {
      return null;
    }

    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf-8'));
    if (payload.exp && Date.now() > payload.exp) {
      return null; // Expired
    }
    return payload;
  } catch {
    return null;
  }
}

export function generateTemporaryPassword(): string {
  // Format: Skill-XXXX-XXXX with high entropy
  const n1 = crypto.randomInt(1000, 9999);
  const n2 = crypto.randomInt(1000, 9999);
  return `Skill-${n1}-${n2}`;
}

export function generateInviteToken(): string {
  return crypto.randomBytes(24).toString('base64url');
}

/**
 * Authentication Middleware:
 * Verifies Bearer token, fetches user from DB, and strictly blocks inactive students!
 */
export async function authenticate(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Authentication required. Please sign in.' });
      return;
    }

    const token = authHeader.substring(7);
    const payload = verifyToken(token);
    if (!payload || !payload.userId) {
      res.status(401).json({ error: 'Session expired or invalid. Please sign in again.' });
      return;
    }

    const user = await db.getUserById(payload.userId);
    if (!user) {
      res.status(401).json({ error: 'Account not found.' });
      return;
    }

    // CRITICAL SECURITY ENFORCEMENT: Deactivated students blocked immediately
    if (!user.isActive) {
      res.status(403).json({
        error: 'Account deactivated. Your access to the 1 Million Naira Skill Challenge has been suspended. Please contact the administrator.',
        deactivated: true,
      });
      return;
    }

    req.user = user;
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
