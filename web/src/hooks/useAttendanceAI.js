import { useEffect, useRef, useState } from 'react';
import { detectPrimary, isLookingAtScreen, loadModels } from '../api/faceEngine.js';
import { getSocket } from '../api/socket.js';

const TICK_MS = 30_000; // must match ENGAGEMENT_SAMPLE_INTERVAL_SEC on the server

/**
 * The automated-attendance loop. Every tick it extracts a face descriptor from
 * the student's own video element and ships it to the server for matching.
 * Only the 128-d vector is transmitted -- never a frame.
 */
export function useAttendanceAI(videoRef, { enabled, sessionId }) {
  const [state, setState] = useState({ ready: false, recognised: false, confidence: 0, engagement: 0, error: null });
  const chatCount = useRef(0);
  const timer = useRef(null);

  useEffect(() => {
    if (!enabled) return undefined;

    let cancelled = false;
    loadModels()
      .then(() => !cancelled && setState((s) => ({ ...s, ready: true })))
      .catch((err) => !cancelled && setState((s) => ({ ...s, error: err })));

    return () => { cancelled = true; };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || !state.ready || !sessionId) return undefined;
    const socket = getSocket();

    async function tick() {
      const video = videoRef.current;
      if (!video || video.readyState < 2) return;

      try {
        const face = await detectPrimary(video);
        if (!face) {
          setState((s) => ({ ...s, recognised: false }));
          return;
        }

        const signals = {
          faceVisible: true,
          lookingAtScreen: isLookingAtScreen(face.landmarks),
          micActive: Boolean(video.srcObject?.getAudioTracks?.()[0]?.enabled),
          tabFocused: document.visibilityState === 'visible',
          chatMessages: chatCount.current,
          faceCount: 1,
        };
        chatCount.current = 0;

        socket.emit('attendance:tick', { descriptor: Array.from(face.descriptor), signals }, (res) => {
          if (res?.ok) {
            setState((s) => ({
              ...s, recognised: true, confidence: res.confidence,
              engagement: res.engagement, status: res.status, error: null,
            }));
          } else {
            setState((s) => ({ ...s, recognised: false }));
          }
        });
      } catch (err) {
        setState((s) => ({ ...s, error: err }));
      }
    }

    tick();
    timer.current = setInterval(tick, TICK_MS);
    return () => clearInterval(timer.current);
  }, [enabled, state.ready, sessionId, videoRef]);

  return { ...state, noteChatMessage: () => { chatCount.current += 1; } };
}
