import crypto from 'node:crypto';
import ClassSession from '../models/ClassSession.js';
import Course from '../models/Course.js';
import Attendance from '../models/Attendance.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { finaliseSession, recordRecognitionTick } from '../services/attendanceService.js';
import { refreshCourse } from '../services/insightService.js';

async function assertTeacherOf(courseId, user) {
  const course = await Course.findById(courseId).select('teacher').lean();
  if (!course) throw new AppError('Course not found', 404);
  if (String(course.teacher) !== String(user._id) && user.role !== 'admin') {
    throw new AppError('Only the course teacher can do this', 403);
  }
  return course;
}

export const listSessions = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.courseId) filter.course = req.query.courseId;
  if (req.query.status) filter.status = req.query.status;

  if (req.user.role === 'student') {
    const courses = await Course.find({ students: req.user._id }).select('_id').lean();
    filter.course = { $in: courses.map((c) => c._id) };
  } else if (req.user.role === 'teacher' && !req.query.courseId) {
    filter.teacher = req.user._id;
  }

  const sessions = await ClassSession.find(filter)
    .populate('course', 'title code coverColor')
    .populate('teacher', 'name avatarUrl')
    .sort({ scheduledStart: -1 })
    .limit(Number(req.query.limit) || 50)
    .lean();

  res.json({ sessions });
});

export const getSession = asyncHandler(async (req, res) => {
  const session = await ClassSession.findById(req.params.id)
    .populate('course', 'title code students')
    .populate('teacher', 'name avatarUrl');
  if (!session) throw new AppError('Session not found', 404);
  res.json({ session });
});

export const createSession = asyncHandler(async (req, res) => {
  await assertTeacherOf(req.body.course, req.user);

  const session = await ClassSession.create({
    ...req.body,
    teacher: req.user._id,
    roomId: crypto.randomBytes(6).toString('hex'),
  });

  res.status(201).json({ session });
});

export const startSession = asyncHandler(async (req, res) => {
  const session = await ClassSession.findById(req.params.id);
  if (!session) throw new AppError('Session not found', 404);
  await assertTeacherOf(session.course, req.user);

  if (session.status === 'ended') throw new AppError('This session has already ended', 409);

  session.status = 'live';
  session.actualStart = session.actualStart || new Date();
  await session.save();

  req.io?.to(`course:${session.course}`).emit('session:started', {
    sessionId: String(session._id),
    roomId: session.roomId,
    title: session.title,
  });

  res.json({ session });
});

export const endSession = asyncHandler(async (req, res) => {
  const session = await ClassSession.findById(req.params.id);
  if (!session) throw new AppError('Session not found', 404);
  await assertTeacherOf(session.course, req.user);

  const summary = await finaliseSession(session._id);
  // Fresh attendance data changes risk scores, so recompute insights now.
  await refreshCourse(session.course);

  req.io?.to(`room:${session.roomId}`).emit('session:ended', { sessionId: String(session._id), summary });

  res.json({ message: 'Session ended', summary });
});

/**
 * HTTP fallback for the recognition tick used by the mobile client, which
 * batches samples instead of holding a socket open.
 */
export const submitRecognition = asyncHandler(async (req, res) => {
  const session = await ClassSession.findById(req.params.id);
  if (!session) throw new AppError('Session not found', 404);
  if (session.status !== 'live') throw new AppError('Session is not live', 409);

  const result = await recordRecognitionTick({
    session,
    descriptor: req.body.descriptor,
    signals: req.body.signals || {},
    claimedStudentId: req.user._id,
  });

  res.json(result);
});

export const sessionAttendance = asyncHandler(async (req, res) => {
  const session = await ClassSession.findById(req.params.id).lean();
  if (!session) throw new AppError('Session not found', 404);

  const records = await Attendance.find({ session: req.params.id })
    .populate('student', 'name email studentId avatarUrl')
    .sort({ status: 1, 'student.name': 1 })
    .lean();

  const summary = records.reduce(
    (acc, r) => ({ ...acc, [r.status]: (acc[r.status] || 0) + 1 }),
    { present: 0, late: 0, partial: 0, absent: 0 }
  );

  res.json({ session, records, summary });
});

/** Teacher override -- AI decisions are always correctable. */
export const overrideAttendance = asyncHandler(async (req, res) => {
  const { studentId, status, reason } = req.body;
  const session = await ClassSession.findById(req.params.id);
  if (!session) throw new AppError('Session not found', 404);
  await assertTeacherOf(session.course, req.user);

  const record = await Attendance.findOneAndUpdate(
    { session: session._id, student: studentId },
    {
      $set: {
        status,
        method: 'override',
        overriddenBy: req.user._id,
        overrideReason: reason || 'Manual correction by teacher',
      },
      $setOnInsert: { course: session.course },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  ).populate('student', 'name avatarUrl');

  res.json({ record });
});

export const saveRecording = asyncHandler(async (req, res) => {
  const session = await ClassSession.findById(req.params.id);
  if (!session) throw new AppError('Session not found', 404);
  await assertTeacherOf(session.course, req.user);

  if (req.file) {
    session.recordingUrl = `/uploads/${req.file.filename}`;
  } else if (req.body.recordingUrl) {
    session.recordingUrl = req.body.recordingUrl;
  } else {
    throw new AppError('No recording provided');
  }

  session.isRecorded = true;
  session.recordingDurationSec = Number(req.body.durationSec) || session.recordingDurationSec;
  await session.save();

  res.json({ session });
});
