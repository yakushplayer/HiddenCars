import { useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api } from '../api.js';

export default function JoinGame() {
  const { gameId } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    password: '',
    displayName: '',
    carModel: '',
    licensePlate: '',
    carColor: '',
  });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  const onChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const onSubmit = async (e) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const data = await api.joinGame(gameId, form);
      localStorage.setItem(`hc_token_${gameId}`, data.token);
      localStorage.setItem(`hc_player_${gameId}`, JSON.stringify(data.player));
      navigate(`/play/${gameId}`);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="page narrow">
      <h1>Вступление в игру</h1>
      <p className="lede">Введи пароль партии и данные своей машины.</p>
      <form className="form" onSubmit={onSubmit}>
        <label>
          Пароль игры
          <input name="password" type="password" value={form.password} onChange={onChange} required />
        </label>
        <label>
          Имя
          <input name="displayName" value={form.displayName} onChange={onChange} required />
        </label>
        <label>
          Машина
          <input name="carModel" value={form.carModel} onChange={onChange} required placeholder="BMW X5" />
        </label>
        <label>
          Госномер
          <input name="licensePlate" value={form.licensePlate} onChange={onChange} required placeholder="А123БВ777" />
        </label>
        <label>
          Цвет
          <input name="carColor" value={form.carColor} onChange={onChange} required placeholder="чёрный" />
        </label>
        {error && <p className="error">{error}</p>}
        <button className="btn primary" type="submit" disabled={busy}>
          {busy ? 'Вход…' : 'Войти в игру'}
        </button>
      </form>
    </section>
  );
}
