import dotenv from 'dotenv';
dotenv.config();

const num = (v, fallback) => (v === undefined ? fallback : Number(v));

export const env = {
  port: num(process.env.PORT, 5000),
  nodeEnv: process.env.NODE_ENV || 'development',
  mongoUri: process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/virtual_classroom',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigin: (process.env.CLIENT_ORIGIN || 'http://localhost:5173').split(',').map((s) => s.trim()),
  seedOnStart: /^(1|true|yes)$/i.test(process.env.SEED_ON_START || ''),

  // AI tuning knobs
  faceMatchThreshold: num(process.env.FACE_MATCH_THRESHOLD, 0.52),
  attendancePresentRatio: num(process.env.ATTENDANCE_PRESENT_RATIO, 0.75),
  attendanceLateGraceMinutes: num(process.env.ATTENDANCE_LATE_GRACE_MINUTES, 10),
  engagementSampleIntervalSec: num(process.env.ENGAGEMENT_SAMPLE_INTERVAL_SEC, 30),
};

if (env.nodeEnv === 'production' && env.jwtSecret === 'dev-only-insecure-secret') {
  throw new Error('JWT_SECRET must be set in production');
}
