import { useEffect, useState } from 'react';
import { io } from 'socket.io-client';

const SOCKET_URL = import.meta.env.VITE_API_URL || undefined;

export function useGameSocket(gameId, handlers = {}) {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!gameId) return undefined;

    // #region agent log
    fetch('http://127.0.0.1:7444/ingest/930f8fe8-1595-4f4f-8dc2-ac681f5516bb',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'a6a517'},body:JSON.stringify({sessionId:'a6a517',runId:'post-fix',hypothesisId:'H2',location:'useGameSocket.js',message:'socket connect attempt',data:{socketUrl:SOCKET_URL||'(same-origin)',pageHost:location.host,gameId},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

    const socket = io(SOCKET_URL, {
      transports: ['websocket', 'polling'],
    });

    socket.on('connect', () => {
      setConnected(true);
      socket.emit('joinGame', gameId);
    });
    socket.on('disconnect', () => setConnected(false));

    if (handlers.onGameUpdated) socket.on('game:updated', handlers.onGameUpdated);
    if (handlers.onPlayerJoined) socket.on('player:joined', handlers.onPlayerJoined);
    if (handlers.onPlayerUpdated) socket.on('player:updated', handlers.onPlayerUpdated);
    if (handlers.onPhotoAdded) socket.on('photo:added', handlers.onPhotoAdded);

    return () => {
      socket.emit('leaveGame', gameId);
      socket.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId]);

  return { connected };
}
