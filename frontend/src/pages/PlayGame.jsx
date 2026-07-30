import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import GameMap from '../components/GameMap.jsx';
import { useGameSocket } from '../hooks/useGameSocket.js';

const statusLabel = {
  joined: 'В игре',
  hidden: 'Спрятался',
  found: 'Найден',
};

export default function PlayGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem(`hc_token_${gameId}`);
  const [game, setGame] = useState(null);
  const [listOpen, setListOpen] = useState(false);
  const [selectedId, setSelectedId] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState('');

  const reload = useCallback(async () => {
    if (!token) return;
    const data = await api.getGame(gameId, token);
    setGame(data);
  }, [gameId, token]);

  useEffect(() => {
    if (!token) {
      navigate(`/join/${gameId}`);
      return;
    }
    reload().catch((e) => setError(e.message));
  }, [token, gameId, navigate, reload]);

  // #region agent log
  useEffect(() => {
    if (!game) return undefined;
    const t = setTimeout(() => {
      const actions = document.querySelector('.play-actions');
      const hud = document.querySelector('.play-hud');
      const btn = document.querySelector('.play-actions .btn');
      const as = actions ? getComputedStyle(actions) : null;
      const bs = btn ? getComputedStyle(btn) : null;
      fetch('http://127.0.0.1:7444/ingest/930f8fe8-1595-4f4f-8dc2-ac681f5516bb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a6a517'},body:JSON.stringify({sessionId:'a6a517',runId:'post-fix',hypothesisId:'H3',location:'PlayGame.jsx:hud-measure',message:'play HUD visibility',data:{hasActions:!!actions,hasHud:!!hud,btnCount:document.querySelectorAll('.play-actions .btn').length,actionsZ:as?.zIndex,actionsBottom:as?.bottom,actionsDisplay:as?.display,btnBg:bs?.backgroundColor,btnColor:bs?.color,btnOpacity:bs?.opacity,btnBorder:bs?.border,btnRect:btn?(()=>{const r=btn.getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,top:r.top,bottom:r.bottom};})():null,vh:window.innerHeight,vw:window.innerWidth},timestamp:Date.now()})}).catch(()=>{});
    }, 400);
    return () => clearTimeout(t);
  }, [game]);
  // #endregion

  useGameSocket(gameId, {
    onGameUpdated: () => reload().catch(() => {}),
    onPlayerJoined: () => reload().catch(() => {}),
    onPlayerUpdated: () => reload().catch(() => {}),
    onPhotoAdded: () => reload().catch(() => {}),
  });

  const me = game?.me;
  const selected = useMemo(
    () => game?.players?.find((p) => p.id === selectedId) || null,
    [game, selectedId]
  );

  const markHidden = async () => {
    setBusy('hidden');
    try {
      await api.markHidden(token);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const markFound = async () => {
    setBusy('found');
    try {
      await api.markFound(token);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy('');
    }
  };

  const onPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy('photo');
    try {
      await api.uploadPhoto(token, file);
      await reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy('');
    }
  };

  if (!game) {
    return (
      <section className="page">
        {error ? <p className="error">{error}</p> : <p className="muted">Загрузка игры…</p>}
      </section>
    );
  }

  return (
    <section className="play-layout">
      <div className="play-map-wrap">
        <GameMap areaGeojson={game.areaGeojson} />
        <div className="play-hud">
          <div className="hud-chip">
            <strong>{game.title}</strong>
            <span>{game.status}</span>
          </div>
          <button type="button" className="btn" onClick={() => setListOpen(true)}>
            Игроки ({game.players?.length || 0})
          </button>
        </div>
        <div className="play-actions">
          {me?.status !== 'found' && (
            <button type="button" className="btn primary" disabled={busy === 'hidden' || me?.status === 'hidden'} onClick={markHidden}>
              {me?.status === 'hidden' ? 'Спрятался ✓' : 'Я спрятался'}
            </button>
          )}
          <label className="btn file-btn">
            {busy === 'photo' ? 'Загрузка…' : 'Фото / камера'}
            <input type="file" accept="image/*" capture="environment" onChange={onPhoto} hidden />
          </label>
          {me?.status !== 'found' && (
            <button type="button" className="btn danger" disabled={busy === 'found'} onClick={markFound}>
              Меня нашли
            </button>
          )}
        </div>
      </div>

      {error && <p className="error floating-error">{error}</p>}

      {listOpen && (
        <div className="drawer" role="dialog">
          <div className="drawer-panel">
            <div className="drawer-head">
              <h2>Игроки</h2>
              <button type="button" className="btn ghost" onClick={() => { setListOpen(false); setSelectedId(null); }}>
                Закрыть
              </button>
            </div>
            {!selected ? (
              <ul className="player-list">
                {(game.players || []).map((p) => (
                  <li key={p.id}>
                    <button type="button" className="player-row" onClick={() => setSelectedId(p.id)}>
                      <span className="swatch" style={{ background: p.carColor }} />
                      <span>
                        <strong>{p.displayName}</strong>
                        <small>{p.carModel} · {p.licensePlate}</small>
                      </span>
                      <em>{statusLabel[p.status] || p.status}</em>
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <PlayerDetail player={selected} token={token} onBack={() => setSelectedId(null)} />
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function PlayerDetail({ player, token, onBack }) {
  const [urls, setUrls] = useState({});

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      const next = {};
      for (const photo of player.photos || []) {
        try {
          const res = await fetch(photo.url.startsWith('http') ? photo.url : `${import.meta.env.VITE_API_URL || ''}${photo.url}`, {
            headers: { Authorization: `Bearer ${token}` },
          });
          if (!res.ok) continue;
          const blob = await res.blob();
          next[photo.id] = URL.createObjectURL(blob);
        } catch {
          // skip
        }
      }
      if (!cancelled) setUrls(next);
    };
    load();
    return () => {
      cancelled = true;
      Object.values(urls).forEach((u) => URL.revokeObjectURL(u));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [player.id, player.photos?.length, token]);

  return (
    <div className="player-detail">
      <button type="button" className="btn ghost" onClick={onBack}>← Назад</button>
      <h3>{player.displayName}</h3>
      <p><strong>Машина:</strong> {player.carModel}</p>
      <p><strong>Номер:</strong> {player.licensePlate}</p>
      <p><strong>Цвет:</strong> {player.carColor}</p>
      <p><strong>Статус:</strong> {statusLabel[player.status] || player.status}</p>
      <div className="photo-grid">
        {(player.photos || []).length === 0 && <p className="muted">Фото пока нет</p>}
        {(player.photos || []).map((ph) => (
          urls[ph.id] ? <img key={ph.id} src={urls[ph.id]} alt="Фото игрока" /> : null
        ))}
      </div>
    </div>
  );
}
