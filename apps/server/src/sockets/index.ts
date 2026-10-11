import { Server } from 'socket.io';
import { verifyToken } from '../utils/jwt';
import { Restaurant } from '../models/Restaurant';
import { Order } from '../models/Order';

let io: Server;

export const initSocket = (server: any) => {
  io = new Server(server, {
    cors: { origin: '*', methods: ['GET', 'POST'] },
  });

  // Token is REQUIRED: without it anyone could join customer:<any> /
  // restaurant:<any> / order:<any> rooms and receive live orders carrying
  // customer PII + QR pickup codes.
  io.use((socket, next) => {
    const token = socket.handshake.auth?.token || socket.handshake.query?.token;
    if (!token || typeof token !== 'string') {
      return next(new Error('Authentication required'));
    }
    try {
      (socket as any).user = verifyToken(token);
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const user = (socket as any).user as { id: string; role: string };
    // console.log('socket connected', socket.id, user);

    // Customers may only listen to their own stream (admins: any, for ops).
    socket.on('join:customer', (customerId: string) => {
      if (typeof customerId !== 'string' || !customerId) return;
      if (customerId !== user.id && user.role !== 'admin') return;
      socket.join(`customer:${customerId}`);
    });

    // Only the restaurant's owner (or admin) may listen to its order stream.
    socket.on('join:restaurant', async (restaurantId: string) => {
      try {
        if (typeof restaurantId !== 'string' || !restaurantId) return;
        if (user.role !== 'admin') {
          const r = await Restaurant.findById(restaurantId).select('ownerId isDeleted');
          if (!r || (r as any).isDeleted || r.ownerId.toString() !== user.id) return;
        }
        socket.join(`restaurant:${restaurantId}`);
      } catch {}
    });

    // Only a participant in the order: its customer, its restaurant's owner, or admin.
    socket.on('join:order', async (orderId: string) => {
      try {
        if (typeof orderId !== 'string' || !orderId) return;
        if (user.role === 'admin') {
          socket.join(`order:${orderId}`);
          return;
        }
        const order = await Order.findById(orderId).select('customerId restaurantId');
        if (!order) return;
        if ((order.customerId as any).toString() === user.id) {
          socket.join(`order:${orderId}`);
          return;
        }
        const r = await Restaurant.findById(order.restaurantId).select('ownerId isDeleted');
        if (r && !(r as any).isDeleted && r.ownerId.toString() === user.id) {
          socket.join(`order:${orderId}`);
        }
      } catch {}
    });

    socket.on('disconnect', () => {});
  });

  return io;
};

export const getIO = (): Server => {
  if (!io) throw new Error('Socket.IO not initialized');
  return io;
};
