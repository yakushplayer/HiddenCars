import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';
import { pool } from './db.js';
import adminRoutes from './adminRoutes.js';
import gameRoutes from './gameRoutes.js';
import { setupSocket } from './socket.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: true, credentials: true },
});

setupSocket(io);

app.use(cors({ origin: true, credentials: true }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', async (req, res) => {
  // #region agent log
  fetch('http://127.0.0.1:7444/ingest/930f8fe8-1595-4f4f-8dc2-ac681f5516bb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a6a517'},body:JSON.stringify({sessionId:'a6a517',runId:'pre-fix',hypothesisId:'H1-H4',location:'index.js:health',message:'health hit',data:{host:req.headers.host||null,origin:req.headers.origin||null,xff:req.headers['x-forwarded-for']||null,ua:(req.headers['user-agent']||'').slice(0,120)},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  try {
    await pool.query('SELECT 1');
    res.json({ ok: true });
  } catch {
    res.status(500).json({ ok: false });
  }
});

app.use('/api/admin', adminRoutes);
app.use('/api', gameRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  const status = err.status || 500;
  res.status(status).json({ error: err.message || 'Server error' });
});

async function tickGamePhases() {
  try {
    const activated = await pool.query(
      `UPDATE games SET status = 'active', updated_at = NOW()
       WHERE status = 'hiding' AND hiding_ends_at IS NOT NULL AND hiding_ends_at <= NOW()
       RETURNING id, title, status, area_geojson, hide_duration_sec, game_duration_sec,
                 photo_limit_per_player, started_at, hiding_ends_at, ends_at, created_at`
    );
    const finished = await pool.query(
      `UPDATE games SET status = 'finished', updated_at = NOW()
       WHERE status IN ('hiding', 'active') AND ends_at IS NOT NULL AND ends_at <= NOW()
       RETURNING id, title, status, area_geojson, hide_duration_sec, game_duration_sec,
                 photo_limit_per_player, started_at, hiding_ends_at, ends_at, created_at`
    );

    const { mapGame } = await import('./adminRoutes.js');
    for (const row of [...activated.rows, ...finished.rows]) {
      io.to(`game:${row.id}`).emit('game:updated', mapGame(row));
    }
  } catch (err) {
    console.error('phase tick error', err.message);
  }
}

const port = Number(process.env.PORT || 3001);
server.listen(port, () => {
  console.log(`HiddenCars API on http://localhost:${port}`);
  setInterval(tickGamePhases, 5000);
});
