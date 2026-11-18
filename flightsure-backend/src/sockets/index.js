import jwt from 'jsonwebtoken';
import User from '../models/User.js';

export function attachSockets(io, config) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (typeof token !== 'string' || !token) {
        return next(new Error('Authentication required.'));
      }
      const payload = jwt.verify(token, config.JWT_ACCESS_SECRET, { algorithms: ['HS256'] });
      const user = await User.findById(payload.sub).select('+tokenVersion');
      if (!user || user.tokenVersion !== payload.tokenVersion) {
        return next(new Error('Invalid session.'));
      }
      socket.data.userId = user.id;
      return next();
    } catch {
      return next(new Error('Invalid or expired access token.'));
    }
  });
  io.on('connection', socket => {
    socket.join(`user:${socket.data.userId}`);
  });
}

export async function publishUserNotification(io, notification) {
  io.to(`user:${notification.userId}`).emit('notification:new', notification.toJSON());
}
