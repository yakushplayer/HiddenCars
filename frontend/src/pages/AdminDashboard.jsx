import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { api } from '../api.js';

export default function AdminDashboard() {
  const navigate = useNavigate();
  const token = localStorage.getItem('hc_admin_token');
  const [games, setGames] = useState([]);
  const [error, setError] = useState('');
  const [form, setForm] = useState({
    title: '',
    joinPassword: '',
    hideDurationSec: 600,
    gameDurationSec: 3600,
    photoLimitPerPlayer: 5,
  });

  useEffect(() => {
    if (!token) {
      navigate('/admin');
      return;
    }
    api.adminGames(token).then(setGames).catch((e) => setError(e.message));
  }, [token, navigate]);

  const create = async (e) => {
    e.preventDefault();
    setError('');
    try {
      const game = await api.adminCreateGame(token, {
        title: form.title,
        joinPassword: form.joinPassword,
        hideDurationSec: Number(form.hideDurationSec),
        gameDurationSec: Number(form.gameDurationSec),
        photoLimitPerPlayer: Number(form.photoLimitPerPlayer),
      });
      navigate(`/admin/games/${game.id}`);
    } catch (err) {
      setError(err.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('hc_admin_token');
    navigate('/admin');
  };

  return (
    <section className="page">
      <div className="row-between">
        <h1>Админ-панель</h1>
        <button type="button" className="btn ghost" onClick={logout}>Выйти</button>
      </div>

      <form className="form panel" onSubmit={create}>
        <h2>Новая игра</h2>
        <label>
          Название
          <input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} required />
        </label>
        <label>
          Пароль для игроков
          <input value={form.joinPassword} onChange={(e) => setForm({ ...form, joinPassword: e.target.value })} required />
        </label>
        <div className="grid-3">
          <label>
            Время спрятаться (сек)
            <input type="number" min="60" value={form.hideDurationSec} onChange={(e) => setForm({ ...form, hideDurationSec: e.target.value })} />
          </label>
          <label>
            Время игры (сек)
            <input type="number" min="60" value={form.gameDurationSec} onChange={(e) => setForm({ ...form, gameDurationSec: e.target.value })} />
          </label>
          <label>
            Лимит фото
            <input type="number" min="1" value={form.photoLimitPerPlayer} onChange={(e) => setForm({ ...form, photoLimitPerPlayer: e.target.value })} />
          </label>
        </div>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit">Создать</button>
      </form>

      <h2>Игры</h2>
      <ul className="game-list">
        {games.map((g) => (
          <li key={g.id}>
            <div>
              <h3>{g.title}</h3>
              <p className="muted">{g.status} · игроков: {g.playerCount ?? 0}</p>
            </div>
            <Link className="btn" to={`/admin/games/${g.id}`}>Открыть</Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
