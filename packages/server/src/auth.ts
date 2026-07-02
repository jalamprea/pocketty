import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { config } from './config.js';

const SUBJECT = 'tui-app-user';

export async function verifyPassword(password: string): Promise<boolean> {
  if (!password) return false;
  return bcrypt.compare(password, config.passwordHash);
}

export function issueToken(): string {
  return jwt.sign({ sub: SUBJECT }, config.jwtSecret, {
    expiresIn: config.tokenTtl as jwt.SignOptions['expiresIn'],
  });
}

export function verifyToken(token: string | undefined | null): boolean {
  if (!token) return false;
  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    return typeof decoded === 'object' && decoded.sub === SUBJECT;
  } catch {
    return false;
  }
}

/** Extracts the token from an Authorization: Bearer <token> header. */
export function tokenFromHeader(header: string | undefined): string | null {
  if (!header) return null;
  const [scheme, value] = header.split(' ');
  if (scheme !== 'Bearer' || !value) return null;
  return value;
}
