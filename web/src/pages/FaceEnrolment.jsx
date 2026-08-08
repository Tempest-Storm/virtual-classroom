import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { captureEnrolmentSamples, loadModels } from '../api/faceEngine.js';
import { authApi } from '../api/client.js';
import { useAuth } from '../context/AuthContext.jsx';

const STEPS = [
  'Look straight at the camera',
  'Turn slightly to your left',
  'Turn slightly to your right',
  'Tilt your head up a little',
  'Smile',
];

export default function FaceEnrolment() {
  const { user, setUser } = useAuth();
  const navigate = useNavigate();
  const video = useRef(null);
  const streamRef = useRef(null);

  const [phase, setPhase] = useState('idle'); // idle | loading | ready | capturing | done | error
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState(null);

  useEffect(() => () => streamRef.current?.getTracks().forEach((t) => t.stop()), []);

  async function start() {
    setPhase('loading');
    setError(null);
    try {
      await loadModels();
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      streamRef.current = stream;
      if (video.current) video.current.srcObject = stream;
      setPhase('ready');
    } catch (err) {
      setError(err.name === 'NotAllowedError'
        ? 'Camera access was denied. Allow it in your browser settings and try again.'
        : err.message);
      setPhase('error');
    }
  }

  async function capture() {
    setPhase('capturing');
    setProgress(0);
    try {
      const samples = await captureEnrolmentSamples(video.current, STEPS.length, (n) => setProgress(n));
      const res = await authApi.enrolFace(samples);
      setUser({ ...user, faceEnrolledAt: res.enrolledAt });
      streamRef.current?.getTracks().forEach((t) => t.stop());
      setPhase('done');
    } catch (err) {
      setError(err.message);
      setPhase('ready');
    }
  }

  async function remove() {
    if (!confirm('Delete your face data? Attendance will have to be marked manually.')) return;
    await authApi.deleteFace();
    setUser({ ...user, faceEnrolledAt: null });
    setPhase('idle');
  }

  return (
    <div className="max-w-2xl mx-auto space-y-5">
      <div>
        <h1 className="text-2xl font-semibold">Face enrolment</h1>
        <p className="secondary-ink text-sm mt-1">
          This lets the system recognise you in live classes and record your attendance automatically.
        </p>
      </div>

      <div className="card p-4 text-sm space-y-2">
        <p className="font-medium">What is stored</p>
        <ul className="space-y-1 secondary-ink">
          <li className="flex gap-2"><span aria-hidden style={{ color: 'var(--status-good)' }}>✓</span>
            A set of 128 numbers per sample — a mathematical signature of your face.</li>
          <li className="flex gap-2"><span aria-hidden style={{ color: 'var(--status-good)' }}>✓</span>
            Computed on this device. Photos and video frames are never uploaded.</li>
          <li className="flex gap-2"><span aria-hidden style={{ color: 'var(--status-good)' }}>✓</span>
            You can delete it at any time, and your teacher can still mark you present manually.</li>
        </ul>
      </div>

      {user?.faceEnrolledAt && phase !== 'capturing' && (
        <div className="card p-4 flex items-center gap-3 flex-wrap">
          <span aria-hidden style={{ color: 'var(--status-good)' }}>✓</span>
          <span className="flex-1 text-sm">
            Enrolled on {new Date(user.faceEnrolledAt).toLocaleDateString()}.
          </span>
          <button className="btn btn-ghost text-sm" onClick={start}>Re-enrol</button>
          <button className="btn btn-ghost text-sm" style={{ color: 'var(--status-critical)' }} onClick={remove}>
            Delete face data
          </button>
        </div>
      )}

      {error && (
        <p className="text-sm px-3 py-2 rounded-lg flex gap-2"
          style={{ background: 'color-mix(in srgb, var(--status-critical) 14%, transparent)' }}>
          <span aria-hidden style={{ color: 'var(--status-critical)' }}>⚠</span>{error}
        </p>
      )}

      {phase === 'done' ? (
        <div className="card p-8 text-center">
          <p className="text-3xl mb-2" aria-hidden style={{ color: 'var(--status-good)' }}>✓</p>
          <p className="font-medium">Enrolment complete</p>
          <p className="text-sm secondary-ink mt-1">
            Your attendance will now be recorded automatically when you join a live class.
          </p>
          <button className="btn btn-primary mt-4" onClick={() => navigate('/')}>Go to dashboard</button>
        </div>
      ) : (
        <div className="card p-5">
          <div className="relative rounded-xl overflow-hidden mx-auto"
            style={{ background: '#111', aspectRatio: '4/3', maxWidth: 480 }}>
            <video ref={video} autoPlay playsInline muted
              className="w-full h-full object-cover" style={{ transform: 'scaleX(-1)' }} />

            {phase === 'idle' && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-sm">
                Camera is off
              </div>
            )}

            {phase === 'capturing' && (
              <>
                <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                  <div className="rounded-full border-4" style={{
                    width: '58%', aspectRatio: 1,
                    borderColor: 'color-mix(in srgb, var(--status-good) 80%, transparent)',
                  }} />
                </div>
                <p className="absolute bottom-3 inset-x-3 text-center text-white text-sm px-3 py-1.5 rounded-lg"
                  style={{ background: 'rgba(0,0,0,.6)' }}>
                  {STEPS[Math.min(progress, STEPS.length - 1)]}
                </p>
              </>
            )}
          </div>

          {phase === 'capturing' && (
            <div className="mt-4 max-w-md mx-auto">
              <div className="flex justify-between text-xs secondary-ink mb-1.5">
                <span>Capturing samples</span>
                <span className="tabular-nums">{progress} / {STEPS.length}</span>
              </div>
              <div className="rounded-full overflow-hidden" style={{ height: 8, background: 'var(--gridline)' }}>
                <div style={{
                  width: `${(progress / STEPS.length) * 100}%`, height: '100%',
                  background: 'var(--series-1)', transition: 'width .3s',
                }} />
              </div>
            </div>
          )}

          <div className="mt-5 flex justify-center gap-2">
            {phase === 'idle' && <button className="btn btn-primary" onClick={start}>Turn on camera</button>}
            {phase === 'loading' && <button className="btn btn-primary" disabled>Loading face models…</button>}
            {phase === 'ready' && <button className="btn btn-primary" onClick={capture}>Start enrolment</button>}
            {phase === 'error' && <button className="btn btn-ghost" onClick={start}>Try again</button>}
          </div>
        </div>
      )}
    </div>
  );
}
