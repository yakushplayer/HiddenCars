const API_BASE = import.meta.env.VITE_API_URL || '';

function authHeaders(token, json = true) {
  const headers = {};
  if (json) headers['Content-Type'] = 'application/json';
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}

async function handle(res) {
  const data = await res.json().catch(() => ({}));
  // #region agent log
  fetch('http://127.0.0.1:7444/ingest/930f8fe8-1595-4f4f-8dc2-ac681f5516bb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a6a517'},body:JSON.stringify({sessionId:'a6a517',runId:'pre-fix',hypothesisId:'H2',location:'api.js:handle',message:'api response',data:{url:String(res.url||''),status:res.status,ok:res.ok,apiBase:API_BASE||'(empty-relative)',pageHost:typeof location!=='undefined'?location.host:'n/a',err:data.error||null},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}

export const api = {
  listGames: () => fetch(`${API_BASE}/api/games`).then(handle),

  joinGame: (id, body) =>
    fetch(`${API_BASE}/api/games/${id}/join`, {
      method: 'POST',
      headers: authHeaders(null),
      body: JSON.stringify(body),
    }).then(handle),

  getGame: (id, token) =>
    fetch(`${API_BASE}/api/games/${id}`, {
      headers: authHeaders(token, false),
    }).then(handle),

  markHidden: (token) =>
    fetch(`${API_BASE}/api/me/hidden`, {
      method: 'POST',
      headers: authHeaders(token, false),
    }).then(handle),

  markFound: (token) =>
    fetch(`${API_BASE}/api/me/found`, {
      method: 'POST',
      headers: authHeaders(token, false),
    }).then(handle),

  uploadPhoto: async (token, file) => {
    const form = new FormData();
    form.append('photo', file);
    const res = await fetch(`${API_BASE}/api/me/photos`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
      body: form,
    });
    return handle(res);
  },

  adminLogin: (login, password) =>
    fetch(`${API_BASE}/api/admin/login`, {
      method: 'POST',
      headers: authHeaders(null),
      body: JSON.stringify({ login, password }),
    }).then(handle),

  adminGames: (token) =>
    fetch(`${API_BASE}/api/admin/games`, {
      headers: authHeaders(token, false),
    }).then(handle),

  adminCreateGame: (token, body) =>
    fetch(`${API_BASE}/api/admin/games`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }).then(handle),

  adminUpdateGame: (token, id, body) =>
    fetch(`${API_BASE}/api/admin/games/${id}`, {
      method: 'PATCH',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    }).then(handle),

  adminGetGame: (token, id) =>
    fetch(`${API_BASE}/api/admin/games/${id}`, {
      headers: authHeaders(token, false),
    }).then(handle),

  adminStartGame: (token, id) =>
    fetch(`${API_BASE}/api/admin/games/${id}/start`, {
      method: 'POST',
      headers: authHeaders(token, false),
    }).then(handle),

  adminFinishGame: (token, id) =>
    fetch(`${API_BASE}/api/admin/games/${id}/finish`, {
      method: 'POST',
      headers: authHeaders(token, false),
    }).then(handle),

  photoUrl: (photoId, token) =>
    `${API_BASE}/api/photos/${photoId}?t=${encodeURIComponent(token)}`,
};

export function photoSrc(photoUrl, token) {
  if (!photoUrl) return '';
  if (photoUrl.startsWith('http')) return photoUrl;
  return `${API_BASE}${photoUrl}`;
}

export async function fetchPhotoBlobUrl(photoId, token) {
  const res = await fetch(`${API_BASE}/api/photos/${photoId}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error('Photo load failed');
  const blob = await res.blob();
  return URL.createObjectURL(blob);
}
