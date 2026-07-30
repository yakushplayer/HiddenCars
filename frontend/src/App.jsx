import { Routes, Route, Link, Navigate } from 'react-router-dom';
import GamesList from './pages/GamesList.jsx';
import JoinGame from './pages/JoinGame.jsx';
import PlayGame from './pages/PlayGame.jsx';
import AdminLogin from './pages/AdminLogin.jsx';
import AdminDashboard from './pages/AdminDashboard.jsx';
import AdminGame from './pages/AdminGame.jsx';

export default function App() {
  return (
    <div className="app-shell">
      <header className="topbar">
        <Link to="/" className="brand">
          HiddenCars
        </Link>
        <nav className="topnav">
          <Link to="/">Игры</Link>
        </nav>
      </header>
      <main className="main">
        <Routes>
          <Route path="/" element={<GamesList />} />
          <Route path="/join/:gameId" element={<JoinGame />} />
          <Route path="/play/:gameId" element={<PlayGame />} />
          <Route path="/admin" element={<AdminLogin />} />
          <Route path="/admin/dashboard" element={<AdminDashboard />} />
          <Route path="/admin/games/:gameId" element={<AdminGame />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
    </div>
  );
}
