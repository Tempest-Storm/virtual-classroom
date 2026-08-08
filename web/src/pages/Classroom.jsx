import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useWebRTC } from '../hooks/useWebRTC.js';
import { useAttendanceAI } from '../hooks/useAttendanceAI.js';
import { getSocket } from '../api/socket.js';
import { sessionApi } from '../api/client.js';
import { Avatar, StatusChip, Spinner } from '../components/ui.jsx';

export default function Classroom() {
  const { roomId } = useParams();
  const { user, isTeacher } = useAuth();
  const navigate = useNavigate();

  const localVideo = useRef(null);
  const [camOn, setCamOn] = useState(true);
  const [micOn, setMicOn] = useState(true);
  const [handRaised, setHandRaised] = useState(false);
  const [chat, setChat] = useState([]);
  const [draft, setDraft] = useState('');
  const [panel, setPanel] = useState(isTeacher ? 'attendance' : 'chat');
  const [live, setLive] = useState([]);       // teacher's live attendance feed
  const [sessionId, setSessionId] = useState(null);
  const [ending, setEnding] = useState(false);

  const { localStream, peers, status, error, toggleTrack, shareScreen } = useWebRTC(roomId);
  const ai = useAttendanceAI(localVideo, { enabled: !isTeacher && camOn, sessionId });

  useEffect(() => {
    if (localVideo.current && localStream) localVideo.current.srcObject = localStream;
  }, [localStream]);

  useEffect(() => {
    const socket = getSocket();

    socket.emit('room:join', { roomId }, (res) => {
      if (res?.session) setSessionId(res.session.id);
    });

    socket.on('chat:message', (m) => {
      setChat((c) => [...c.slice(-99), m]);
      if (m.user.id === user.id) ai.noteChatMessage();
    });

    socket.on('attendance:update', (u) => {
      setLive((prev) => {
        const rest = prev.filter((p) => p.studentId !== u.studentId);
        return [u, ...rest].slice(0, 60);
      });
    });

    socket.on('session:ended', () => navigate('/'));

    return () => { socket.off('chat:message'); socket.off('attendance:update'); socket.off('session:ended'); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [roomId]);

  function send(e) {
    e.preventDefault();
    const text = draft.trim();
    if (!text) return;
    getSocket().emit('chat:message', { text });
    setDraft('');
  }

  async function endClass() {
    if (!confirm('End the class for everyone? Attendance will be finalised and insights regenerated.')) return;
    setEnding(true);
    try {
      await sessionApi.end(sessionId);
      navigate('/');
    } catch (err) {
      alert(err.message);
      setEnding(false);
    }
  }

  if (status === 'error') {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card p-6 max-w-md text-center">
          <p className="text-2xl mb-2" aria-hidden style={{ color: 'var(--status-critical)' }}>⚠</p>
          <p className="font-medium">Could not join the class</p>
          <p className="text-sm secondary-ink mt-1">{error?.message}</p>
          <button className="btn btn-ghost mt-4" onClick={() => navigate('/')}>Back to dashboard</button>
        </div>
      </div>
    );
  }

  if (status === 'connecting') return <Spinner label="Connecting to the classroom" />;

  const tiles = [
    { key: 'me', user, stream: localStream, isMe: true },
    ...peers.map((p) => ({ key: p.socketId, user: p.user, stream: p.stream, media: p.media })),
  ];

  return (
    <div className="min-h-screen flex flex-col" style={{ background: 'var(--plane)' }}>
      <header className="h-14 px-4 flex items-center gap-3 border-b" style={{ borderColor: 'var(--border)' }}>
        <span className="flex items-center gap-2 font-medium">
          <span aria-hidden style={{ color: 'var(--status-critical)' }}>●</span> Live class
        </span>
        <span className="text-sm muted">{tiles.length} in the room</span>

        {!isTeacher && (
          <span className="ml-2">
            {ai.error ? <StatusChip status="warning">Face model unavailable</StatusChip>
              : !ai.ready ? <StatusChip status="pending">Loading AI…</StatusChip>
              : ai.recognised ? <StatusChip status="present">Attendance recorded</StatusChip>
              : <StatusChip status="pending">Looking for you…</StatusChip>}
          </span>
        )}

        <div className="ml-auto flex items-center gap-2">
          {isTeacher && (
            <button className="btn btn-danger" onClick={endClass} disabled={ending || !sessionId}>
              {ending ? 'Ending…' : 'End class'}
            </button>
          )}
          <button className="btn btn-ghost" onClick={() => navigate('/')}>Leave</button>
        </div>
      </header>

      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        <section className="flex-1 p-4 overflow-auto">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {tiles.map((t) => (
              <VideoTile key={t.key} {...t} localRef={t.isMe ? localVideo : undefined}
                camOn={t.isMe ? camOn : t.media?.camera !== false}
                micOn={t.isMe ? micOn : t.media?.mic !== false} />
            ))}
          </div>

          {!isTeacher && ai.ready && (
            <p className="text-xs muted mt-4 max-w-2xl">
              Your camera image never leaves this device. Every 30 seconds the app computes a
              numeric face signature locally and sends only that to confirm your attendance.
              {ai.engagement > 0 && ` Current engagement score: ${ai.engagement}/100.`}
            </p>
          )}
        </section>

        <aside className="lg:w-96 border-t lg:border-t-0 lg:border-l flex flex-col min-h-0"
          style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
          <div className="flex border-b" style={{ borderColor: 'var(--border)' }}>
            {(isTeacher ? ['attendance', 'chat'] : ['chat']).map((t) => (
              <button key={t} onClick={() => setPanel(t)}
                className="flex-1 py-2.5 text-sm font-medium capitalize"
                style={panel === t
                  ? { color: 'var(--series-1)', boxShadow: 'inset 0 -2px 0 var(--series-1)' }
                  : { color: 'var(--text-secondary)' }}>
                {t}
              </button>
            ))}
          </div>

          {panel === 'chat' ? (
            <>
              <div className="flex-1 overflow-auto p-3 space-y-3 min-h-64">
                {chat.length === 0 && <p className="text-sm muted text-center py-8">No messages yet.</p>}
                {chat.map((m) => (
                  <div key={m.id} className="flex gap-2">
                    <Avatar user={m.user} size={26} />
                    <div className="min-w-0">
                      <p className="text-xs muted">
                        {m.user.name}
                        {m.user.role !== 'student' && <span className="ml-1" style={{ color: 'var(--series-1)' }}>· teacher</span>}
                      </p>
                      <p className="text-sm break-words">{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>
              <form onSubmit={send} className="p-3 border-t flex gap-2" style={{ borderColor: 'var(--border)' }}>
                <input className="input" placeholder="Message the class" value={draft}
                  onChange={(e) => setDraft(e.target.value)} maxLength={2000} />
                <button className="btn btn-primary" disabled={!draft.trim()}>Send</button>
              </form>
            </>
          ) : (
            <div className="flex-1 overflow-auto p-3">
              <p className="text-xs muted mb-3">
                Updates as the AI recognises each student. Correct any mistake from the
                attendance report after class.
              </p>
              {live.length === 0 && <p className="text-sm muted text-center py-8">No students recognised yet.</p>}
              <ul className="space-y-2">
                {live.map((s) => (
                  <li key={s.studentId} className="flex items-center gap-2.5">
                    <Avatar user={s} size={28} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium truncate">{s.name}</p>
                      <p className="text-xs muted">
                        {Math.round(s.confidence * 100)}% match · engagement {s.engagement}
                      </p>
                    </div>
                    <StatusChip status={s.status} />
                  </li>
                ))}
              </ul>
            </div>
          )}
        </aside>
      </div>

      <footer className="h-16 px-4 flex items-center justify-center gap-2 border-t"
        style={{ borderColor: 'var(--border)', background: 'var(--surface-1)' }}>
        <ControlButton active={micOn} onClick={() => setMicOn(toggleTrack('audio'))}
          onIcon="🎤" offIcon="🔇" label={micOn ? 'Mute' : 'Unmute'} />
        <ControlButton active={camOn} onClick={() => setCamOn(toggleTrack('video'))}
          onIcon="📷" offIcon="🚫" label={camOn ? 'Stop video' : 'Start video'} />
        <ControlButton active onClick={() => shareScreen().catch(() => {})} onIcon="🖥" label="Share screen" />
        <ControlButton active={handRaised}
          onClick={() => { const next = !handRaised; setHandRaised(next); getSocket().emit('hand:raise', { raised: next }); }}
          onIcon="✋" label={handRaised ? 'Lower hand' : 'Raise hand'} />
      </footer>
    </div>
  );
}

function ControlButton({ active, onClick, onIcon, offIcon, label }) {
  return (
    <button onClick={onClick} title={label} aria-label={label}
      className="btn"
      style={active
        ? { background: 'color-mix(in srgb, var(--series-1) 14%, transparent)', color: 'var(--series-1)' }
        : { background: 'color-mix(in srgb, var(--status-critical) 14%, transparent)', color: 'var(--status-critical)' }}>
      <span aria-hidden>{active ? onIcon : offIcon || onIcon}</span>
      <span className="hidden sm:inline text-xs">{label}</span>
    </button>
  );
}

function VideoTile({ user, stream, isMe, localRef, camOn, micOn }) {
  const ref = useRef(null);
  const videoRef = localRef || ref;

  useEffect(() => {
    if (videoRef.current && stream && !localRef) videoRef.current.srcObject = stream;
  }, [stream, videoRef, localRef]);

  return (
    <div className="relative rounded-xl overflow-hidden aspect-video"
      style={{ background: '#111', border: '1px solid var(--border)' }}>
      <video ref={videoRef} autoPlay playsInline muted={isMe}
        className="w-full h-full object-cover" style={{ transform: isMe ? 'scaleX(-1)' : undefined }} />

      {!camOn && (
        <div className="absolute inset-0 flex items-center justify-center" style={{ background: '#111' }}>
          <Avatar user={user} size={56} />
        </div>
      )}

      <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2">
        <span className="text-xs px-2 py-0.5 rounded-md text-white truncate"
          style={{ background: 'rgba(0,0,0,.55)' }}>
          {user?.name}{isMe && ' (you)'}
        </span>
        {!micOn && <span className="text-xs px-1.5 py-0.5 rounded-md text-white"
          style={{ background: 'rgba(0,0,0,.55)' }} aria-label="Muted">🔇</span>}
      </div>
    </div>
  );
}
