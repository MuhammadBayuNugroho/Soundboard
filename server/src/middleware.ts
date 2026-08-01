import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getDb } from './db.js';

export interface AuthenticatedRequest extends Request {
  user?: {
    username: string;
  };
}

const JWT_SECRET_DEFAULT = 'sacp-super-secret-key-123';

export async function getJwtSecret(): Promise<string> {
  try {
    const db = await getDb();
    const secretSetting = await db.get('SELECT value FROM settings WHERE key = ?', ['jwt_secret']);
    if (secretSetting && secretSetting.value) {
      return secretSetting.value;
    }
    
    // Seed and return default if not present
    await db.run('INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)', ['jwt_secret', JWT_SECRET_DEFAULT]);
    return JWT_SECRET_DEFAULT;
  } catch (err) {
    return JWT_SECRET_DEFAULT;
  }
}

export async function authenticateToken(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    res.status(401).json({ error: 'Akses ditolak. Token tidak ditemukan.' });
    return;
  }

  const secret = await getJwtSecret();

  jwt.verify(token, secret, (err: any, user: any) => {
    if (err) {
      res.status(403).json({ error: 'Token tidak valid atau kedaluwarsa.' });
      return;
    }
    req.user = user;
    next();
  });
}

export function errorHandler(err: any, req: Request, res: Response, next: NextFunction) {
  console.error('Unhandled error:', err);
  res.status(500).json({
    error: err.message || 'Terjadi kesalahan internal pada server.'
  });
}
