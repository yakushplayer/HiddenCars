import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';

const statusLabel = {
  lobby: 'Лобби',
  hiding: 'Прятки',
  active: 'Поиск',
  finished: 'Завершена',
};

export default function GamesList() {
  const [games, setGames] = useState([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .listGames()
      .then(setGames)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return (
    <section className="page">
      <div className="hero-block">
        <p className="eyebrow">Прятки на машинах</p>
        <h1>HiddenCars</h1>
        <p className="lede">Выбери игру и вступи по паролю от админа. Без геолокации — только зона на карте.</p>
      </div>

      {loading && <p className="muted">Загрузка…</p>}
      {error && <p className="error">{error}</p>}

      {!loading && !games.length && (
        <div className="empty">
          <h2>Пока нет игр</h2>
          <p>Админ ещё не создал партию. Загляни позже или попроси создать игру.</p>
        </div>
      )}

      <ul className="game-list">
        {games.map((g) => (
          <li key={g.id}>
            <div>
              <h3>{g.title}</h3>
              <p className="muted">
                {statusLabel[g.status] || g.status}
                {typeof g.playerCount === 'number' ? ` · ${g.playerCount} игр.` : ''}
              </p>
            </div>
            <Link className="btn" to={`/join/${g.id}`}>
              Вступить
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
