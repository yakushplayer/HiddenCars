import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App.jsx';
import './styles.css';

// #region agent log
fetch('http://127.0.0.1:7444/ingest/930f8fe8-1595-4f4f-8dc2-ac681f5516bb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a6a517'},body:JSON.stringify({sessionId:'a6a517',runId:'pre-fix',hypothesisId:'H1-H2',location:'main.jsx:boot',message:'frontend boot env',data:{href:location.href,host:location.host,hostname:location.hostname,protocol:location.protocol,apiBase:import.meta.env.VITE_API_URL||'(empty-relative)',ua:navigator.userAgent,online:navigator.onLine,touch:'ontouchstart' in window},timestamp:Date.now()})}).catch(()=>{});
// #endregion

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </React.StrictMode>
);
