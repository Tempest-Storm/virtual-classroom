import { useCallback, useEffect, useRef, useState } from 'react';
import { getSocket } from '../api/socket.js';

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:global.stun.twilio.com:3478' },
  // Add a TURN server here for participants behind symmetric NAT.
];

/**
 * Mesh WebRTC: every participant peers directly with every other. Fine up to
 * ~8 concurrent cameras; past that, swap the signalling for an SFU and keep
 * this hook's interface unchanged.
 */
export function useWebRTC(roomId, { enabled = true } = {}) {
  const [localStream, setLocalStream] = useState(null);
  const [peers, setPeers] = useState([]);      // { socketId, user, stream, media }
  const [status, setStatus] = useState('connecting');
  const [error, setError] = useState(null);

  const connections = useRef(new Map());       // socketId -> RTCPeerConnection
  const localRef = useRef(null);
  const socketRef = useRef(null);

  const upsertPeer = useCallback((socketId, patch) => {
    setPeers((prev) => {
      const idx = prev.findIndex((p) => p.socketId === socketId);
      if (idx === -1) return [...prev, { socketId, ...patch }];
      const next = [...prev];
      next[idx] = { ...next[idx], ...patch };
      return next;
    });
  }, []);

  const createConnection = useCallback((socketId, user) => {
    if (connections.current.has(socketId)) return connections.current.get(socketId);

    const pc = new RTCPeerConnection({ iceServers: ICE_SERVERS });
    connections.current.set(socketId, pc);

    localRef.current?.getTracks().forEach((track) => pc.addTrack(track, localRef.current));

    pc.ontrack = (e) => upsertPeer(socketId, { user, stream: e.streams[0] });
    pc.onicecandidate = (e) => {
      if (e.candidate) socketRef.current?.emit('signal:ice', { to: socketId, candidate: e.candidate });
    };
    pc.onconnectionstatechange = () => {
      if (['failed', 'closed'].includes(pc.connectionState)) removePeer(socketId);
    };

    upsertPeer(socketId, { user });
    return pc;
  }, [upsertPeer]);

  const removePeer = useCallback((socketId) => {
    connections.current.get(socketId)?.close();
    connections.current.delete(socketId);
    setPeers((prev) => prev.filter((p) => p.socketId !== socketId));
  }, []);

  useEffect(() => {
    if (!enabled || !roomId) return undefined;
    let cancelled = false;
    const socket = getSocket();
    socketRef.current = socket;

    async function start() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 640, height: 480, facingMode: 'user' },
          audio: { echoCancellation: true, noiseSuppression: true },
        });
        if (cancelled) return stream.getTracks().forEach((t) => t.stop());

        localRef.current = stream;
        setLocalStream(stream);

        socket.emit('room:join', { roomId }, async (res) => {
          if (res?.error) { setError(new Error(res.error)); setStatus('error'); return; }
          setStatus('connected');

          // We are the newcomer, so we initiate offers to everyone already here.
          for (const peer of res.peers) {
            const pc = createConnection(peer.socketId, peer.user);
            const offer = await pc.createOffer();
            await pc.setLocalDescription(offer);
            socket.emit('signal:offer', { to: peer.socketId, description: offer });
          }
        });
      } catch (err) {
        setError(new Error(
          err.name === 'NotAllowedError'
            ? 'Camera and microphone access is required to join the class.'
            : err.message
        ));
        setStatus('error');
      }
    }

    socket.on('signal:offer', async ({ from, user, description }) => {
      const pc = createConnection(from, user);
      await pc.setRemoteDescription(description);
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      socket.emit('signal:answer', { to: from, description: answer });
    });

    socket.on('signal:answer', async ({ from, description }) => {
      await connections.current.get(from)?.setRemoteDescription(description);
    });

    socket.on('signal:ice', async ({ from, candidate }) => {
      try { await connections.current.get(from)?.addIceCandidate(candidate); }
      catch (err) { console.warn('[rtc] ice', err.message); }
    });

    socket.on('peer:left', ({ socketId }) => removePeer(socketId));
    socket.on('media:state', ({ socketId, camera, mic, screen }) =>
      upsertPeer(socketId, { media: { camera, mic, screen } }));

    start();

    return () => {
      cancelled = true;
      socket.emit('room:leave');
      ['signal:offer', 'signal:answer', 'signal:ice', 'peer:left', 'media:state']
        .forEach((e) => socket.off(e));
      connections.current.forEach((pc) => pc.close());
      connections.current.clear();
      localRef.current?.getTracks().forEach((t) => t.stop());
    };
  }, [roomId, enabled, createConnection, removePeer, upsertPeer]);

  const toggleTrack = useCallback((kind) => {
    const track = localRef.current?.[kind === 'video' ? 'getVideoTracks' : 'getAudioTracks']()[0];
    if (!track) return false;
    track.enabled = !track.enabled;
    socketRef.current?.emit('media:state', {
      camera: localRef.current.getVideoTracks()[0]?.enabled,
      mic: localRef.current.getAudioTracks()[0]?.enabled,
    });
    return track.enabled;
  }, []);

  /** Replaces the outgoing video track on every peer connection. */
  const shareScreen = useCallback(async () => {
    const display = await navigator.mediaDevices.getDisplayMedia({ video: true });
    const screenTrack = display.getVideoTracks()[0];

    connections.current.forEach((pc) => {
      pc.getSenders().find((s) => s.track?.kind === 'video')?.replaceTrack(screenTrack);
    });

    screenTrack.onended = () => {
      const camTrack = localRef.current?.getVideoTracks()[0];
      connections.current.forEach((pc) => {
        pc.getSenders().find((s) => s.track?.kind === 'video')?.replaceTrack(camTrack);
      });
    };
    return display;
  }, []);

  return { localStream, peers, status, error, toggleTrack, shareScreen };
}
