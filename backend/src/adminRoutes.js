import { Router } from 'express';
import { comparePassword, createAdminToken, hashPassword } from './auth.js';
import { query } from './db.js';
import { requireAdmin } from './middleware.js';
import { getIo } from './socket.js';

const router = Router();

router.post('/login', async (req, res, next) => {
  try {
    const { login, password } = req.body || {};
    if (!login || !password) {
      return res.status(400).json({ error: 'login and password required' });
    }

    const { rows } = await query('SELECT * FROM admins WHERE login = $1', [login]);
    if (!rows.length) return res.status(401).json({ error: 'Invalid credentials' });

    const admin = rows[0];
    const ok = await comparePassword(password, admin.password_hash);
    if (!ok) return res.status(401).json({ error: 'Invalid credentials' });

    const token = createAdminToken(admin);
    res.json({ token, admin: { id: admin.id, login: admin.login } });
  } catch (err) {
    next(err);
  }
});

router.post('/games', requireAdmin, async (req, res, next) => {
  try {
    const {
      title,
      joinPassword,
      areaGeojson = null,
      hideDurationSec = 600,
      gameDurationSec = 3600,
      photoLimitPerPlayer = 5,
    } = req.body || {};

    if (!title || !joinPassword) {
      return res.status(400).json({ error: 'title and joinPassword required' });
    }

    const passwordHash = await hashPassword(joinPassword);
    const { rows } = await query(
      `INSERT INTO games (
         title, join_password_hash, area_geojson,
         hide_duration_sec, game_duration_sec, photo_limit_per_player, created_by
       ) VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING id, title, status, area_geojson, hide_duration_sec, game_duration_sec,
                 photo_limit_per_player, started_at, hiding_ends_at, ends_at, created_at`,
      [
        title,
        passwordHash,
        areaGeojson ? JSON.stringify(areaGeojson) : null,
        hideDurationSec,
        gameDurationSec,
        photoLimitPerPlayer,
        req.admin.adminId,
      ]
    );

    res.status(201).json(mapGame(rows[0]));
  } catch (err) {
    next(err);
  }
});

router.get('/games', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT g.*,
              (SELECT COUNT(*)::int FROM players p WHERE p.game_id = g.id) AS player_count
       FROM games g
       ORDER BY g.created_at DESC`
    );
    res.json(rows.map(mapGame));
  } catch (err) {
    next(err);
  }
});

router.get('/games/:id', requireAdmin, async (req, res, next) => {
  try {
    const game = await loadGameDetail(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json(game);
  } catch (err) {
    next(err);
  }
});

router.patch('/games/:id', requireAdmin, async (req, res, next) => {
  try {
    const { rows: existing } = await query('SELECT * FROM games WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Game not found' });
    const game = existing[0];
    if (game.status !== 'lobby') {
      return res.status(400).json({ error: 'Can only edit games in lobby' });
    }

    const {
      title = game.title,
      joinPassword,
      areaGeojson = game.area_geojson,
      hideDurationSec = game.hide_duration_sec,
      gameDurationSec = game.game_duration_sec,
      photoLimitPerPlayer = game.photo_limit_per_player,
    } = req.body || {};

    let passwordHash = game.join_password_hash;
    if (joinPassword) passwordHash = await hashPassword(joinPassword);

    const { rows } = await query(
      `UPDATE games SET
         title = $1,
         join_password_hash = $2,
         area_geojson = $3,
         hide_duration_sec = $4,
         game_duration_sec = $5,
         photo_limit_per_player = $6,
         updated_at = NOW()
       WHERE id = $7
       RETURNING id, title, status, area_geojson, hide_duration_sec, game_duration_sec,
                 photo_limit_per_player, started_at, hiding_ends_at, ends_at, created_at`,
      [
        title,
        passwordHash,
        areaGeojson ? JSON.stringify(areaGeojson) : null,
        hideDurationSec,
        gameDurationSec,
        photoLimitPerPlayer,
        req.params.id,
      ]
    );

    const mapped = mapGame(rows[0]);
    getIo()?.to(`game:${req.params.id}`).emit('game:updated', mapped);
    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

router.post('/games/:id/start', requireAdmin, async (req, res, next) => {
  try {
    const { rows: existing } = await query('SELECT * FROM games WHERE id = $1', [req.params.id]);
    if (!existing.length) return res.status(404).json({ error: 'Game not found' });
    const game = existing[0];
    if (game.status !== 'lobby') {
      return res.status(400).json({ error: 'Game already started or finished' });
    }
    if (!game.area_geojson) {
      return res.status(400).json({ error: 'Draw game area before starting' });
    }

    const startedAt = new Date();
    const hidingEndsAt = new Date(startedAt.getTime() + game.hide_duration_sec * 1000);
    const endsAt = new Date(hidingEndsAt.getTime() + game.game_duration_sec * 1000);

    const { rows } = await query(
      `UPDATE games SET
         status = 'hiding',
         started_at = $1,
         hiding_ends_at = $2,
         ends_at = $3,
         updated_at = NOW()
       WHERE id = $4
       RETURNING id, title, status, area_geojson, hide_duration_sec, game_duration_sec,
                 photo_limit_per_player, started_at, hiding_ends_at, ends_at, created_at`,
      [startedAt.toISOString(), hidingEndsAt.toISOString(), endsAt.toISOString(), req.params.id]
    );

    const mapped = mapGame(rows[0]);
    getIo()?.to(`game:${req.params.id}`).emit('game:updated', mapped);
    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

router.post('/games/:id/finish', requireAdmin, async (req, res, next) => {
  try {
    const { rows } = await query(
      `UPDATE games SET status = 'finished', updated_at = NOW()
       WHERE id = $1 AND status IN ('hiding', 'active')
       RETURNING id, title, status, area_geojson, hide_duration_sec, game_duration_sec,
                 photo_limit_per_player, started_at, hiding_ends_at, ends_at, created_at`,
      [req.params.id]
    );
    if (!rows.length) return res.status(400).json({ error: 'Cannot finish this game' });
    const mapped = mapGame(rows[0]);
    getIo()?.to(`game:${req.params.id}`).emit('game:updated', mapped);
    res.json(mapped);
  } catch (err) {
    next(err);
  }
});

export function mapGame(row) {
  return {
    id: row.id,
    title: row.title,
    status: row.status,
    areaGeojson: row.area_geojson,
    hideDurationSec: row.hide_duration_sec,
    gameDurationSec: row.game_duration_sec,
    photoLimitPerPlayer: row.photo_limit_per_player,
    startedAt: row.started_at,
    hidingEndsAt: row.hiding_ends_at,
    endsAt: row.ends_at,
    createdAt: row.created_at,
    playerCount: row.player_count ?? undefined,
  };
}

export async function loadGameDetail(gameId) {
  const { rows } = await query(
    `SELECT id, title, status, area_geojson, hide_duration_sec, game_duration_sec,
            photo_limit_per_player, started_at, hiding_ends_at, ends_at, created_at
     FROM games WHERE id = $1`,
    [gameId]
  );
  if (!rows.length) return null;

  const game = mapGame(rows[0]);
  const { rows: players } = await query(
    `SELECT id, display_name, car_model, license_plate, car_color, status,
            hidden_at, found_at, joined_at
     FROM players WHERE game_id = $1 ORDER BY joined_at ASC`,
    [gameId]
  );

  const { rows: photos } = await query(
    `SELECT id, player_id, mime_type, created_at FROM player_photos WHERE game_id = $1 ORDER BY created_at ASC`,
    [gameId]
  );

  const photosByPlayer = {};
  for (const p of photos) {
    if (!photosByPlayer[p.player_id]) photosByPlayer[p.player_id] = [];
    photosByPlayer[p.player_id].push({
      id: p.id,
      url: `/api/photos/${p.id}`,
      mimeType: p.mime_type,
      createdAt: p.created_at,
    });
  }

  game.players = players.map((p) => ({
    id: p.id,
    displayName: p.display_name,
    carModel: p.car_model,
    licensePlate: p.license_plate,
    carColor: p.car_color,
    status: p.status,
    hiddenAt: p.hidden_at,
    foundAt: p.found_at,
    joinedAt: p.joined_at,
    photos: photosByPlayer[p.id] || [],
  }));

  return game;
}

export default router;
