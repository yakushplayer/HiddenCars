import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import {
  comparePassword,
  createPlayerSessionToken,
  hashToken,
} from './auth.js';
import { query, uploadDir } from './db.js';
import { requirePlayer, requireGameAccess } from './middleware.js';
import { loadGameDetail, mapGame } from './adminRoutes.js';
import { getIo } from './socket.js';

const router = Router();

fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname || '') || '.jpg';
    cb(null, `${uuidv4()}${ext}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only images allowed'));
    }
    cb(null, true);
  },
});

router.get('/games', async (_req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT g.id, g.title, g.status, g.hide_duration_sec, g.game_duration_sec,
              g.started_at, g.hiding_ends_at, g.ends_at, g.created_at,
              (SELECT COUNT(*)::int FROM players p WHERE p.game_id = g.id) AS player_count
       FROM games g
       WHERE g.status IN ('lobby', 'hiding', 'active')
       ORDER BY g.created_at DESC`
    );
    res.json(rows.map(mapGame));
  } catch (err) {
    next(err);
  }
});

router.post('/games/:id/join', async (req, res, next) => {
  try {
    const {
      password,
      displayName,
      carModel,
      licensePlate,
      carColor,
    } = req.body || {};

    if (!password || !displayName || !carModel || !licensePlate || !carColor) {
      return res.status(400).json({
        error: 'password, displayName, carModel, licensePlate, carColor required',
      });
    }

    const { rows } = await query('SELECT * FROM games WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Game not found' });
    const game = rows[0];

    if (game.status === 'finished') {
      return res.status(400).json({ error: 'Game finished' });
    }

    const ok = await comparePassword(password, game.join_password_hash);
    if (!ok) return res.status(401).json({ error: 'Wrong password' });

    const sessionToken = createPlayerSessionToken();
    const sessionHash = hashToken(sessionToken);

    try {
      const { rows: playerRows } = await query(
        `INSERT INTO players (
           game_id, display_name, car_model, license_plate, car_color, session_token_hash
         ) VALUES ($1,$2,$3,$4,$5,$6)
         RETURNING id, game_id, display_name, car_model, license_plate, car_color, status,
                   hidden_at, found_at, joined_at`,
        [
          game.id,
          displayName.trim(),
          carModel.trim(),
          licensePlate.trim().toUpperCase(),
          carColor.trim(),
          sessionHash,
        ]
      );

      const player = mapPlayer(playerRows[0]);
      getIo()?.to(`game:${game.id}`).emit('player:joined', player);

      res.status(201).json({
        token: sessionToken,
        player,
        game: mapGame(game),
      });
    } catch (err) {
      if (err.code === '23505') {
        return res.status(409).json({ error: 'This license plate already joined' });
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

router.get('/games/:id', requireGameAccess, async (req, res, next) => {
  try {
    if (req.player && req.player.game_id !== req.params.id) {
      return res.status(403).json({ error: 'Wrong game' });
    }
    const game = await loadGameDetail(req.params.id);
    if (!game) return res.status(404).json({ error: 'Game not found' });
    res.json({
      ...game,
      me: req.player ? mapPlayer(req.player) : null,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/me', requirePlayer, async (req, res) => {
  res.json({ player: mapPlayer(req.player) });
});

router.post('/me/hidden', requirePlayer, async (req, res, next) => {
  try {
    const { rows: games } = await query('SELECT status FROM games WHERE id = $1', [
      req.player.game_id,
    ]);
    if (!games.length) return res.status(404).json({ error: 'Game not found' });
    if (!['hiding', 'active'].includes(games[0].status)) {
      return res.status(400).json({ error: 'Game not in progress' });
    }
    if (req.player.status === 'found') {
      return res.status(400).json({ error: 'Already found' });
    }

    const { rows } = await query(
      `UPDATE players SET status = 'hidden', hidden_at = COALESCE(hidden_at, NOW())
       WHERE id = $1
       RETURNING id, game_id, display_name, car_model, license_plate, car_color, status,
                 hidden_at, found_at, joined_at`,
      [req.player.id]
    );

    const player = mapPlayer(rows[0]);
    getIo()?.to(`game:${req.player.game_id}`).emit('player:updated', player);
    res.json({ player });
  } catch (err) {
    next(err);
  }
});

router.post('/me/found', requirePlayer, async (req, res, next) => {
  try {
    const { rows: games } = await query('SELECT status FROM games WHERE id = $1', [
      req.player.game_id,
    ]);
    if (!games.length) return res.status(404).json({ error: 'Game not found' });
    if (!['hiding', 'active'].includes(games[0].status)) {
      return res.status(400).json({ error: 'Game not in progress' });
    }

    const { rows } = await query(
      `UPDATE players SET status = 'found', found_at = NOW()
       WHERE id = $1
       RETURNING id, game_id, display_name, car_model, license_plate, car_color, status,
                 hidden_at, found_at, joined_at`,
      [req.player.id]
    );

    const player = mapPlayer(rows[0]);
    getIo()?.to(`game:${req.player.game_id}`).emit('player:updated', player);
    res.json({ player });
  } catch (err) {
    next(err);
  }
});

router.post('/me/photos', requirePlayer, upload.single('photo'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'photo required' });

    const { rows: games } = await query(
      'SELECT status, photo_limit_per_player FROM games WHERE id = $1',
      [req.player.game_id]
    );
    if (!games.length) return res.status(404).json({ error: 'Game not found' });
    if (games[0].status === 'finished') {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Game finished' });
    }

    const { rows: countRows } = await query(
      'SELECT COUNT(*)::int AS c FROM player_photos WHERE player_id = $1',
      [req.player.id]
    );
    if (countRows[0].c >= games[0].photo_limit_per_player) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Photo limit reached' });
    }

    const relativePath = req.file.filename;
    const { rows } = await query(
      `INSERT INTO player_photos (player_id, game_id, file_path, mime_type)
       VALUES ($1,$2,$3,$4)
       RETURNING id, player_id, mime_type, created_at`,
      [req.player.id, req.player.game_id, relativePath, req.file.mimetype]
    );

    const photo = {
      id: rows[0].id,
      playerId: rows[0].player_id,
      url: `/api/photos/${rows[0].id}`,
      mimeType: rows[0].mime_type,
      createdAt: rows[0].created_at,
    };

    getIo()?.to(`game:${req.player.game_id}`).emit('photo:added', photo);
    res.status(201).json({ photo });
  } catch (err) {
    next(err);
  }
});

router.get('/photos/:id', requireGameAccess, async (req, res, next) => {
  try {
    const { rows } = await query('SELECT * FROM player_photos WHERE id = $1', [req.params.id]);
    if (!rows.length) return res.status(404).json({ error: 'Not found' });
    const photo = rows[0];

    if (req.player && req.player.game_id !== photo.game_id) {
      return res.status(403).json({ error: 'Forbidden' });
    }

    const filePath = path.join(uploadDir, photo.file_path);
    if (!fs.existsSync(filePath)) return res.status(404).json({ error: 'File missing' });

    res.setHeader('Content-Type', photo.mime_type);
    fs.createReadStream(filePath).pipe(res);
  } catch (err) {
    next(err);
  }
});

function mapPlayer(row) {
  return {
    id: row.id,
    gameId: row.game_id,
    displayName: row.display_name,
    carModel: row.car_model,
    licensePlate: row.license_plate,
    carColor: row.car_color,
    status: row.status,
    hiddenAt: row.hidden_at,
    foundAt: row.found_at,
    joinedAt: row.joined_at,
  };
}

export default router;
