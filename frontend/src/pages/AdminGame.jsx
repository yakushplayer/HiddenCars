import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';
import GameMap from '../components/GameMap.jsx';
import { useGameSocket } from '../hooks/useGameSocket.js';

export default function AdminGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const token = localStorage.getItem('hc_admin_token');
  const [game, setGame] = useState(null);
  const [area, setArea] = useState(null);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const reload = useCallback(async () => {
    const data = await api.adminGetGame(token, gameId);
    setGame(data);
    setArea(data.areaGeojson);
  }, [token, gameId]);

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    reload().catch((e) => setError(e.message));
  }, [token, navigate, reload]);

  useGameSocket(gameId, {
    onGameUpdated: () => reload().catch(() => {}),
    onPlayerJoined: () => reload().catch(() => {}),
    onPlayerUpdated: () => reload().catch(() => {}),
    onPhotoAdded: () => reload().catch(() => {}),
  });

  const saveArea = async () => {
    setBusy(true);
    setError('');
    try {
      await api.adminUpdateGame(token, gameId, { areaGeojson: area });
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const start = async () => {
    setBusy(true);
    setError('');
    try {
      if (area) {
        await api.adminUpdateGame(token, gameId, { areaGeojson: area });
      }
      await api.adminStartGame(token, gameId);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  const finish = async () => {
    setBusy(true);
    try {
      await api.adminFinishGame(token, gameId);
      await reload();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  if (!game) {
    return <section className="page">{error || 'Загрузка…'}</section>;
  }

  return (
    <section className="page admin-game">
      <div className="row-between">
        <div>
          <h1>{game.title}</h1>
          <p className="muted">Статус: {game.status} · игроков: {game.players?.length || 0}</p>
        </div>
        <div className="btn-row">
          {game.status === 'lobby' && (
            <>
              <button type="button" className="btn" disabled={busy} onClick={saveArea}>Сохранить зону</button>
              <button type="button" className="btn primary" disabled={busy} onClick={start}>Начать игру</button>
            </>
          )}
          {(game.status === 'hiding' || game.status === 'active') && (
            <button type="button" className="btn danger" disabled={busy} onClick={finish}>Завершить</button>
          )}
        </div>
      </div>

      {error && <p className="error">{error}</p>}

      <p className="lede">
        {game.status === 'lobby'
          ? 'Нарисуй полигон игровой зоны на карте (инструменты слева), сохрани и нажми «Начать».'
          : 'Игровая зона и список участников обновляются в реальном времени.'}
      </p>

      <div className="admin-map-wrap">
        <GameMap
          areaGeojson={area}
          editable={game.status === 'lobby'}
          onAreaChange={setArea}
        />
      </div>

      <h2>Участники</h2>
      <ul className="player-list static">
        {(game.players || []).map((p) => (
          <li key={p.id} className="player-row static">
            <span className="swatch" style={{ background: p.carColor }} />
            <span>
              <strong>{p.displayName}</strong>
              <small>{p.carModel} · {p.licensePlate} · фото: {p.photos?.length || 0}</small>
            </span>
            <em>{p.status}</em>
          </li>
        ))}
        {!game.players?.length && <li className="muted">Пока никто не вступил</li>}
      </ul>
    </section>
  );
}
