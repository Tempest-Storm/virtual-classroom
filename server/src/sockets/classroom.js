import { Server } from 'socket.io';
import { verifyToken } from '../middleware/auth.js';
import User from '../models/User.js';
import ClassSession from '../models/ClassSession.js';
import { recordRecognitionTick } from '../services/attendanceService.js';
import { env } from '../config/env.js';

/**
 * Realtime layer:
 *  - WebRTC signalling for the live classroom (mesh topology, teacher = host)
 *  - the AI attendance tick, pushed by each participant every N seconds
 *  - chat, hand-raise, and live attendance updates for the teacher panel
 */
export function initSockets(httpServer) {
  const io = new Server(httpServer, {
    cors: { origin: env.clientOrigin, credentials: true },
    maxHttpBufferSize: 2e6,
  });

  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error('Authentication required'));
      const payload = verifyToken(token);
      const user = await User.findById(payload.sub).select('name role avatarUrl').lean();
      if (!user) return next(new Error('User not found'));
      socket.user = user;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', (socket) => {
    const { user } = socket;
    socket.join(`user:${user._id}`);

    socket.on('room:join', async ({ roomId }, ack) => {
      const session = await ClassSession.findOne({ roomId }).lean();
      if (!session) return ack?.({ error: 'Room not found' });
      if (session.status !== 'live') return ack?.({ error: 'This class has not started yet' });

      socket.join(`room:${roomId}`);
      socket.data.roomId = roomId;
      socket.data.sessionId = String(session._id);

      const peers = [...(io.sockets.adapter.rooms.get(`room:${roomId}`) || [])]
        .filter((id) => id !== socket.id)
        .map((id) => {
          const s = io.sockets.sockets.get(id);
          return { socketId: id, user: s?.user };
        });

      socket.to(`room:${roomId}`).emit('peer:joined', { socketId: socket.id, user });
      ack?.({ ok: true, peers, session: { id: String(session._id), title: session.title } });
    });

    // --- WebRTC signalling (relayed verbatim, never inspected) ---
    socket.on('signal:offer', ({ to, description }) =>
      io.to(to).emit('signal:offer', { from: socket.id, user, description }));

    socket.on('signal:answer', ({ to, description }) =>
      io.to(to).emit('signal:answer', { from: socket.id, description }));

    socket.on('signal:ice', ({ to, candidate }) =>
      io.to(to).emit('signal:ice', { from: socket.id, candidate }));

    socket.on('media:state', ({ camera, mic, screen }) =>
      socket.to(`room:${socket.data.roomId}`).emit('media:state', { socketId: socket.id, camera, mic, screen }));

    // --- AI attendance tick ---
    socket.on('attendance:tick', async ({ descriptor, signals }, ack) => {
      try {
        if (!socket.data.sessionId) return ack?.({ error: 'Not in a room' });

        const session = await ClassSession.findById(socket.data.sessionId);
        if (!session || session.status !== 'live') return ack?.({ error: 'Session is not live' });

        const result = await recordRecognitionTick({
          session,
          descriptor,
          signals: signals || {},
          claimedStudentId: user._id,
        });

        if (result.ok) {
          // Teachers watch the live attendance panel update as students are seen.
          io.to(`room:${socket.data.roomId}`).emit('attendance:update', {
            studentId: result.studentId,
            name: result.name,
            avatarUrl: result.avatarUrl,
            status: result.status,
            confidence: result.confidence,
            engagement: result.engagement,
            flags: result.flags,
            at: new Date().toISOString(),
          });
        }
        ack?.(result);
      } catch (err) {
        ack?.({ error: err.message });
      }
    });

    // --- Classroom interaction ---
    socket.on('chat:message', ({ text }) => {
      const trimmed = String(text || '').slice(0, 2000).trim();
      if (!trimmed) return;
      io.to(`room:${socket.data.roomId}`).emit('chat:message', {
        id: `${Date.now()}-${socket.id}`,
        user: { id: user._id, name: user.name, avatarUrl: user.avatarUrl, role: user.role },
        text: trimmed,
        at: new Date().toISOString(),
      });
    });

    socket.on('hand:raise', ({ raised }) =>
      io.to(`room:${socket.data.roomId}`).emit('hand:raise', { socketId: socket.id, user, raised: Boolean(raised) }));

    socket.on('room:leave', () => leave(socket));
    socket.on('disconnect', () => leave(socket));

    function leave(s) {
      const room = s.data.roomId;
      if (!room) return;
      s.to(`room:${room}`).emit('peer:left', { socketId: s.id, user: s.user });
      s.leave(`room:${room}`);
      s.data.roomId = null;
    }
  });

  return io;
}
