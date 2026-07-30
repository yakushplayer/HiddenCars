import { verifyAdminToken, hashToken } from './auth.js';
import { query } from './db.js';

export function requireAdmin(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });
    req.admin = verifyAdminToken(token);
    next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized' });
  }
}

export async function requirePlayer(req, res, next) {
  try {
    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Unauthorized' });

    const tokenHash = hashToken(token);
    const { rows } = await query(
      `SELECT id, game_id, display_name, car_model, license_plate, car_color, status,
              hidden_at, found_at, joined_at
       FROM players WHERE session_token_hash = $1`,
      [tokenHash]
    );
    if (!rows.length) return res.status(401).json({ error: 'Unauthorized' });

    req.player = rows[0];
    req.playerToken = token;
    next();
  } catch (err) {
    next(err);
  }
}

export async function requireGameAccess(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Unauthorized' });

  try {
    req.admin = verifyAdminToken(token);
    return next();
  } catch {
    // not admin — try player
  }

  try {
    const tokenHash = hashToken(token);
    const { rows } = await query(
      `SELECT id, game_id, display_name, status FROM players WHERE session_token_hash = $1`,
      [tokenHash]
    );
    if (!rows.length) return res.status(401).json({ error: 'Unauthorized' });
    req.player = rows[0];
    return next();
  } catch (err) {
    return next(err);
  }
}
