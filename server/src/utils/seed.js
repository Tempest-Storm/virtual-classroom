/**
 * Demo data: 1 teacher, 8 students, 2 courses, past sessions with AI
 * attendance already recorded, assignments, grades, and generated insights.
 *
 *   npm run seed            # wipes and reseeds
 */
import crypto from 'node:crypto';
import mongoose from 'mongoose';
import { connectDB } from '../config/db.js';
import User from '../models/User.js';
import Course from '../models/Course.js';
import ClassSession from '../models/ClassSession.js';
import Attendance from '../models/Attendance.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Insight from '../models/Insight.js';
import { refreshCourse } from '../services/insightService.js';

const rand = (min, max) => min + Math.random() * (max - min);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const daysAgo = (n) => new Date(Date.now() - n * 86400000);
const daysAhead = (n) => new Date(Date.now() + n * 86400000);

/**
 * A plausible 128-d face descriptor, unique per person.
 *
 * Uses a seeded PRNG rather than a sinusoid: sinusoidal vectors alias against
 * each other, so two different "people" can land inside the match threshold
 * and the demo shows false identifications. Uniform noise in [-0.15, 0.15]
 * puts distinct identities ~1.4 apart -- far outside the 0.52 threshold --
 * while enrolment samples of the same person stay within ~0.1.
 */
function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** identity = the person; sample = which enrolment capture of that person. */
function fakeDescriptor(identity, sample = 0) {
  const base = mulberry32(identity * 7919);
  const jitter = mulberry32(identity * 7919 + sample + 1);
  return Array.from({ length: 128 }, () => (base() - 0.5) * 0.3 + (jitter() - 0.5) * 0.02);
}

const STUDENTS = [
  { name: 'Amina Yusuf', profile: 'strong' },
  { name: 'Daniel Okoye', profile: 'strong' },
  { name: 'Grace Mensah', profile: 'average' },
  { name: 'Ibrahim Sule', profile: 'average' },
  { name: 'Chidera Nwosu', profile: 'average' },
  { name: 'Peter Adeyemi', profile: 'struggling' },
  { name: 'Zainab Bello', profile: 'struggling' },
  { name: 'Samuel Kimani', profile: 'declining' },
];

const PROFILES = {
  strong:      { attend: [0.9, 1.0], score: [85, 98], engage: [78, 95], trend: 0 },
  average:     { attend: [0.7, 0.9], score: [65, 82], engage: [55, 78], trend: 0 },
  struggling:  { attend: [0.4, 0.65], score: [35, 58], engage: [30, 55], trend: 0 },
  declining:   { attend: [0.55, 0.8], score: [75, 85], engage: [45, 70], trend: -6 },
};

export async function seedDatabase() {
  console.log('[seed] clearing collections...');
  await Promise.all([
    User.deleteMany({}), Course.deleteMany({}), ClassSession.deleteMany({}),
    Attendance.deleteMany({}), Assignment.deleteMany({}), Submission.deleteMany({}),
    Insight.deleteMany({}),
  ]);

  const teacher = await User.create({
    name: 'Dr. Fatima Bala', email: 'teacher@demo.io', password: 'Password123',
    role: 'teacher', department: 'Computer Science',
  });

  const admin = await User.create({
    name: 'System Admin', email: 'admin@demo.io', password: 'Password123', role: 'admin',
  });

  const students = [];
  for (const [i, s] of STUDENTS.entries()) {
    const descriptors = [0, 1, 2].map((k) => fakeDescriptor(i + 1, k));
    students.push(await User.create({
      name: s.name,
      email: `${s.name.split(' ')[0].toLowerCase()}@demo.io`,
      password: 'Password123',
      role: 'student',
      studentId: `CS/2024/${String(i + 101).padStart(4, '0')}`,
      department: 'Computer Science',
      faceDescriptors: descriptors,
      faceEnrolledAt: daysAgo(30),
    }));
  }
  const profileOf = new Map(students.map((s, i) => [String(s._id), PROFILES[STUDENTS[i].profile]]));

  const courses = await Course.create([
    {
      title: 'Introduction to Machine Learning', code: 'CSC401', teacher: teacher._id,
      students: students.map((s) => s._id), coverColor: '#4f46e5', credits: 3,
      description: 'Supervised and unsupervised learning, model evaluation, and neural networks.',
      schedule: [{ day: 'Monday', startTime: '10:00', endTime: '12:00' }],
    },
    {
      title: 'Database Systems', code: 'CSC312', teacher: teacher._id,
      students: students.slice(0, 6).map((s) => s._id), coverColor: '#0d9488', credits: 3,
      description: 'Relational modelling, normalisation, transactions, and query optimisation.',
      schedule: [{ day: 'Wednesday', startTime: '14:00', endTime: '16:00' }],
    },
  ]);

  for (const course of courses) {
    // --- past sessions with AI attendance ---
    for (let w = 8; w >= 1; w -= 1) {
      const start = daysAgo(w * 7);
      start.setHours(10, 0, 0, 0);
      const end = new Date(start.getTime() + 2 * 3600000);

      const session = await ClassSession.create({
        course: course._id, teacher: teacher._id,
        title: `Week ${9 - w}: ${pick(['Foundations', 'Deep Dive', 'Lab Practical', 'Case Study', 'Revision'])}`,
        topic: course.code,
        scheduledStart: start, scheduledEnd: end,
        actualStart: start, actualEnd: end,
        status: 'ended',
        roomId: crypto.randomBytes(6).toString('hex'),
        isRecorded: true,
        recordingUrl: `/uploads/demo-recording-${course.code}-${9 - w}.mp4`,
        recordingDurationSec: 7200,
      });

      const totalTicks = 240; // 2h at 30s ticks
      for (const student of course.students) {
        const p = profileOf.get(String(student));
        const ratio = rand(p.attend[0], p.attend[1]);
        const recognised = Math.round(totalTicks * ratio);
        const attended = ratio > 0.15;

        await Attendance.create({
          session: session._id, course: course._id, student,
          status: !attended ? 'absent' : ratio >= 0.75 ? (Math.random() < 0.15 ? 'late' : 'present') : 'partial',
          joinedAt: attended ? new Date(start.getTime() + rand(0, 15) * 60000) : undefined,
          leftAt: attended ? end : undefined,
          recognisedSamples: attended ? recognised : 0,
          totalSamples: totalTicks,
          presenceRatio: attended ? Number(ratio.toFixed(3)) : 0,
          avgConfidence: attended ? Number(rand(0.55, 0.88).toFixed(3)) : 0,
          engagementScore: attended ? Number(rand(p.engage[0], p.engage[1]).toFixed(1)) : 0,
          minutesPresent: attended ? Math.round(recognised * 0.5) : 0,
          method: 'ai-face',
        });
      }
    }

    // --- upcoming live session ---
    await ClassSession.create({
      course: course._id, teacher: teacher._id,
      title: 'Week 9: Model Evaluation & Metrics', topic: course.code,
      scheduledStart: daysAhead(1), scheduledEnd: new Date(daysAhead(1).getTime() + 2 * 3600000),
      status: 'scheduled', roomId: crypto.randomBytes(6).toString('hex'),
    });

    // --- assignments + submissions ---
    const assignments = await Assignment.create(
      [
        { title: 'Problem Set 1', type: 'homework', maxScore: 100, weight: 1, dueDate: daysAgo(42) },
        { title: 'Mid-semester Quiz', type: 'quiz', maxScore: 50, weight: 2, dueDate: daysAgo(28) },
        { title: 'Group Project Milestone', type: 'project', maxScore: 100, weight: 3, dueDate: daysAgo(14) },
        { title: 'Problem Set 2', type: 'homework', maxScore: 100, weight: 1, dueDate: daysAgo(5) },
        { title: 'Final Project', type: 'project', maxScore: 100, weight: 4, dueDate: daysAhead(10) },
      ].map((a) => ({ ...a, course: course._id, teacher: teacher._id, instructions: `See the course notes for ${a.title}.` }))
    );

    for (const [idx, assignment] of assignments.entries()) {
      if (new Date(assignment.dueDate) > new Date()) continue; // not due yet

      for (const student of course.students) {
        const p = profileOf.get(String(student));
        if (p.attend[1] < 0.7 && Math.random() < 0.35) continue; // struggling students skip work

        const drift = p.trend * idx;
        const raw = Math.max(0, Math.min(assignment.maxScore,
          (rand(p.score[0], p.score[1]) + drift) / 100 * assignment.maxScore));
        const isLate = Math.random() < (p.attend[1] < 0.7 ? 0.4 : 0.1);
        const score = Number((raw * (isLate ? 0.9 : 1)).toFixed(2));

        await Submission.create({
          assignment: assignment._id, course: course._id, student,
          text: 'Submitted via the virtual classroom.',
          submittedAt: new Date(new Date(assignment.dueDate).getTime() + (isLate ? 86400000 : -3600000)),
          isLate, rawScore: Number(raw.toFixed(2)), score,
          feedback: score / assignment.maxScore > 0.8 ? 'Excellent work.' : 'Review the feedback notes and resubmit questions.',
          gradedAt: new Date(), gradedBy: teacher._id, status: 'graded',
        });
      }
    }

    const result = await refreshCourse(course._id);
    console.log(`[seed] ${course.code}: ${result.insights} insights generated`);
  }

  console.log(`
[seed] done.

  Teacher  teacher@demo.io  / Password123
  Admin    admin@demo.io    / Password123
  Students amina@demo.io, daniel@demo.io, grace@demo.io, ibrahim@demo.io,
           chidera@demo.io, peter@demo.io, zainab@demo.io, samuel@demo.io
           (all Password123)
`);
}

/** Seed only when the database is empty — safe to call on every boot. */
export async function seedIfEmpty() {
  const count = await User.estimatedDocumentCount();
  if (count > 0) {
    console.log(`[seed] database already has ${count} users — skipping auto-seed`);
    return false;
  }
  console.log('[seed] empty database detected — seeding demo data…');
  await seedDatabase();
  return true;
}

// CLI entry (`npm run seed`): connect, wipe + seed, disconnect.
const isCli = process.argv[1] && process.argv[1].replace(/\\/g, '/').endsWith('/utils/seed.js');
if (isCli) {
  connectDB()
    .then(seedDatabase)
    .then(() => mongoose.disconnect())
    .catch((err) => {
      console.error('[seed] failed:', err);
      process.exit(1);
    });
}
