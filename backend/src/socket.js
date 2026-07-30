let io = null;

export function setIo(instance) {
  io = instance;
}

export function getIo() {
  return io;
}

export function setupSocket(ioInstance) {
  setIo(ioInstance);

  ioInstance.on('connection', (socket) => {
    socket.on('joinGame', (gameId) => {
      if (typeof gameId === 'string' && gameId.length > 0) {
        socket.join(`game:${gameId}`);
      }
    });

    socket.on('leaveGame', (gameId) => {
      if (typeof gameId === 'string') {
        socket.leave(`game:${gameId}`);
      }
    });
  });
}
