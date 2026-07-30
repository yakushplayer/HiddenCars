import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.JWT_SECRET || 'dev-secret';

export function hashPassword(password) {
  return bcrypt.hash(password, 10);
}

export function comparePassword(password, hash) {
  return bcrypt.compare(password, hash);
}

export function createAdminToken(admin) {
  return jwt.sign(
    { role: 'admin', adminId: admin.id, login: admin.login },
    jwtSecret,
    { expiresIn: '7d' }
  );
}

export function verifyAdminToken(token) {
  const payload = jwt.verify(token, jwtSecret);
  if (payload.role !== 'admin') throw new Error('Not admin');
  return payload;
}

export function createPlayerSessionToken() {
  return crypto.randomBytes(32).toString('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}
