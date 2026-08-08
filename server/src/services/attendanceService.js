import mongoose from 'mongoose';
import Attendance from '../models/Attendance.js';
import Course from '../models/Course.js';
import User from '../models/User.js';
import ClassSession from '../models/ClassSession.js';
import { env } from '../config/env.js';
import { matchDescriptor, isAmbiguous, computeEngagement, isValidDescriptor } from './faceService.js';

/** In-memory roster cache so we don't hit Mongo on every recognition tick. */
const rosterCache = new Map(); // courseId -> { at: number, roster: [...] }
const ROSTER_TTL_MS = 60_000;

export async function getRoster(courseId) {
  const key = String(courseId);
  const hit = rosterCache.get(key);
  if (hit && Date.now() - hit.at < ROSTER_TTL_MS) return hit.roster;

  const course = await Course.findById(courseId).select('students').lean();
  if (!course) return [];

  const students = await User.find({ _id: { $in: course.students }, isActive: true })
    .select('+faceDescriptors name email studentId avatarUrl')
    .lean();

  const roster = students.map((s) => ({
    userId: s._id,
    name: s.name,
    avatarUrl: s.avatarUrl,
    descriptors: s.faceDescriptors || [],
  }));

  rosterCache.set(key, { at: Date.now(), roster });
  return roster;
}

export function invalidateRoster(courseId) {
  rosterCache.delete(String(courseId));
}

/**
 * Core AI tick. A client sends the descriptor(s) it detected in its own video
 * frame; we identify the student and fold the observation into their record.
 */
export async function recordRecognitionTick({ session, descriptor, signals = {}, claimedStudentId }) {
  if (!isValidDescriptor(descriptor)) {
    return { ok: false, reason: 'invalid-descriptor' };
  }

  const roster = await getRoster(session.course);
  const result = matchDescriptor(descriptor, roster);
  const flags = [];

  if (!result.matched) {
    return { ok: false, reason: 'no-match', distance: result.distance };
  }
  if (isAmbiguous(result)) flags.push('low-confidence');
  if (claimedStudentId && String(claimedStudentId) !== result.userId) {
    flags.push('identity-mismatch');
  }
  if (signals.faceCount > 1) flags.push('multiple-faces');

  const engagement = computeEngagement(signals);

  const doc = await Attendance.findOneAndUpdate(
    { session: session._id, student: result.userId },
    {
      $setOnInsert: {
        course: session.course,
        joinedAt: new Date(),
        method: 'ai-face',
      },
      $inc: { recognisedSamples: 1, totalSamples: 1 },
      $set: { leftAt: new Date() },
      ...(flags.length ? { $addToSet: { flags: { $each: flags } } } : {}),
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  // Running averages, kept incremental so the write stays O(1).
  const n = doc.recognisedSamples;
  doc.avgConfidence = Number((((doc.avgConfidence * (n - 1)) + result.confidence) / n).toFixed(4));
  doc.engagementScore = Number((((doc.engagementScore * (n - 1)) + engagement) / n).toFixed(2));
  doc.presenceRatio = presenceRatio(doc, session);
  doc.minutesPresent = Math.round((n * env.engagementSampleIntervalSec) / 60);
  doc.status = deriveStatus(doc, session);
  await doc.save();

  const student = roster.find((r) => String(r.userId) === result.userId);
  return {
    ok: true,
    studentId: result.userId,
    name: student?.name,
    avatarUrl: student?.avatarUrl,
    confidence: result.confidence,
    engagement,
    status: doc.status,
    flags,
  };
}

/**
 * How many recognition ticks the class has run for so far. This -- not the
 * number of samples a student happened to send -- is the denominator for
 * presence. Otherwise a student who appears for one tick and disappears
 * scores 1/1 = 100% present.
 */
export function expectedTicks(session, until = new Date()) {
  const start = new Date(session.actualStart || session.scheduledStart);
  const end = session.actualEnd ? new Date(session.actualEnd) : until;
  const elapsedSec = Math.max(0, (end - start) / 1000);
  return Math.max(1, Math.round(elapsedSec / env.engagementSampleIntervalSec));
}

export function presenceRatio(attendance, session) {
  const expected = expectedTicks(session);
  return Number(Math.min(1, attendance.recognisedSamples / expected).toFixed(4));
}

/**
 * Status rules:
 *   present -> seen for >= ATTENDANCE_PRESENT_RATIO of the class and joined on time
 *   late    -> met the ratio but joined after the grace period
 *   partial -> seen, but below the ratio
 *   absent  -> never recognised
 */
export function deriveStatus(attendance, session) {
  if (!attendance.recognisedSamples) return 'absent';

  const ratio = attendance.presenceRatio ?? 0;
  const start = session.actualStart || session.scheduledStart;
  const lateBy = attendance.joinedAt ? (attendance.joinedAt - new Date(start)) / 60000 : 0;

  if (ratio >= env.attendancePresentRatio) {
    return lateBy > env.attendanceLateGraceMinutes ? 'late' : 'present';
  }
  return 'partial';
}

/** Called when a session ends: fill in absentees and freeze every status. */
export async function finaliseSession(sessionId) {
  const session = await ClassSession.findById(sessionId);
  if (!session) throw new Error('Session not found');

  const course = await Course.findById(session.course).select('students').lean();
  const existing = await Attendance.find({ session: sessionId });
  const seen = new Set(existing.map((a) => String(a.student)));

  const absentees = (course?.students || [])
    .filter((s) => !seen.has(String(s)))
    .map((studentId) => ({
      session: sessionId,
      course: session.course,
      student: studentId,
      status: 'absent',
      method: 'ai-face',
    }));

  if (absentees.length) await Attendance.insertMany(absentees, { ordered: false });

  session.status = 'ended';
  session.actualEnd = session.actualEnd || new Date();
  await session.save();

  // Re-derive against the *full* session length now that it is known, so a
  // student who left at half time is scored against the whole class.
  for (const record of existing) {
    if (record.method === 'override') continue;
    record.presenceRatio = presenceRatio(record, session);
    record.status = deriveStatus(record, session);
    await record.save();
  }

  return {
    sessionId,
    present: existing.filter((a) => a.status === 'present').length,
    late: existing.filter((a) => a.status === 'late').length,
    partial: existing.filter((a) => a.status === 'partial').length,
    absent: absentees.length,
  };
}

/**
 * Attendance credit per status. A student who sits through half of every
 * class is not absent -- scoring 'partial' as zero would wrongly read as
 * "never showed up" and inflate their risk score.
 */
export const STATUS_CREDIT = { present: 1, late: 1, partial: 0.5, absent: 0 };

export async function attendanceRateFor(studentId, courseId) {
  const match = { student: new mongoose.Types.ObjectId(studentId) };
  if (courseId) match.course = new mongoose.Types.ObjectId(courseId);

  const [row] = await Attendance.aggregate([
    { $match: match },
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        // Full sessions attended -- what a register would show.
        attended: { $sum: { $cond: [{ $in: ['$status', ['present', 'late']] }, 1, 0] } },
        partial: { $sum: { $cond: [{ $eq: ['$status', 'partial'] }, 1, 0] } },
        absent: { $sum: { $cond: [{ $eq: ['$status', 'absent'] }, 1, 0] } },
        // Weighted credit -- what the rate and the risk model use.
        credit: {
          $sum: {
            $switch: {
              branches: [
                { case: { $in: ['$status', ['present', 'late']] }, then: STATUS_CREDIT.present },
                { case: { $eq: ['$status', 'partial'] }, then: STATUS_CREDIT.partial },
              ],
              default: 0,
            },
          },
        },
        avgEngagement: { $avg: '$engagementScore' },
      },
    },
  ]);

  if (!row?.total) {
    return { total: 0, attended: 0, partial: 0, absent: 0, rate: 0, avgEngagement: 0 };
  }
  return {
    total: row.total,
    attended: row.attended,
    partial: row.partial,
    absent: row.absent,
    rate: Number(((row.credit / row.total) * 100).toFixed(1)),
    avgEngagement: Number((row.avgEngagement || 0).toFixed(1)),
  };
}
