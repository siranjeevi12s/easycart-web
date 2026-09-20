import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt';

let io: Server;

export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (token) {
      try {
        const payload = verifyToken(token as string);
        (socket as any).user = payload;
      } catch {}
    }
    next();
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user;
    // console.log('socket connected', socket.id, user);

    socket.on('join:customer', (customerId: string) => {
      socket.join(`customer:${customerId}`);
    });
    socket.on('join:restaurant', (restaurantId: string) => {
      socket.join(`restaurant:${restaurantId}`);
    });
    socket.on('join:order', (orderId: string) => {
      socket.join(`order:${orderId}`);
    });

    socket.on('disconnect', () => {});
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};
