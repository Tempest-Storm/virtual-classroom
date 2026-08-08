import Course from '../models/Course.js';
import Insight from '../models/Insight.js';
import Attendance from '../models/Attendance.js';
import ClassSession from '../models/ClassSession.js';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import {
  studentOverview, studentCourseAnalytics, courseAnalytics,
} from '../services/analyticsService.js';
import { refreshCourse } from '../services/insightService.js';

/** Student dashboard payload. */
export const myDashboard = asyncHandler(async (req, res) => {
  const [overview, upcoming, insights, pending] = await Promise.all([
    studentOverview(req.user._id),
    ClassSession.find({
      course: { $in: (await Course.find({ students: req.user._id }).select('_id').lean()).map((c) => c._id) },
      status: { $in: ['scheduled', 'live'] },
      scheduledEnd: { $gte: new Date() },
    })
      .populate('course', 'title code coverColor')
      .sort({ scheduledStart: 1 })
      .limit(5)
      .lean(),
    Insight.find({ scope: 'student', student: req.user._id, acknowledgedAt: null })
      .populate('course', 'title code')
      .sort({ severity: 1, createdAt: -1 })
      .limit(10)
      .lean(),
    pendingAssignments(req.user._id),
  ]);

  res.json({ overview, upcomingSessions: upcoming, insights, pendingAssignments: pending });
});

async function pendingAssignments(studentId) {
  const courses = await Course.find({ students: studentId }).select('_id').lean();
  const assignments = await Assignment.find({
    course: { $in: courses.map((c) => c._id) },
    isPublished: true,
    dueDate: { $gte: new Date() },
  })
    .populate('course', 'title code coverColor')
    .sort({ dueDate: 1 })
    .limit(10)
    .lean();

  const submitted = new Set(
    (await Submission.find({ student: studentId, assignment: { $in: assignments.map((a) => a._id) } })
      .select('assignment').lean()).map((s) => String(s.assignment))
  );

  return assignments.filter((a) => !submitted.has(String(a._id)));
}

/** Teacher dashboard payload. */
export const teacherDashboard = asyncHandler(async (req, res) => {
  const courses = await Course.find({ teacher: req.user._id, isArchived: false }).lean();
  const courseIds = courses.map((c) => c._id);

  const [analytics, upcoming, insights, ungraded] = await Promise.all([
    Promise.all(courseIds.map((id) => courseAnalytics(id))),
    ClassSession.find({ teacher: req.user._id, status: { $in: ['scheduled', 'live'] } })
      .populate('course', 'title code coverColor')
      .sort({ scheduledStart: 1 })
      .limit(5)
      .lean(),
    Insight.find({ scope: 'course', course: { $in: courseIds }, acknowledgedAt: null })
      .populate('course', 'title code')
      .sort({ createdAt: -1 })
      .limit(10)
      .lean(),
    Submission.countDocuments({ course: { $in: courseIds }, score: null }),
  ]);

  const totalStudents = courses.reduce((s, c) => s + (c.students?.length || 0), 0);
  const atRisk = analytics.flatMap((a) => a.rows.filter((r) => r.risk.level === 'high').map((r) => ({
    student: r.student,
    course: { id: a.courseId, title: a.title },
    risk: r.risk,
    attendance: r.attendance.rate,
    grade: r.grade.percent,
  })));

  res.json({
    summary: {
      courses: courses.length,
      students: totalStudents,
      ungradedSubmissions: ungraded,
      atRiskStudents: atRisk.length,
      averageAttendance: avg(analytics.map((a) => a.averageAttendance)),
      classAverage: avg(analytics.map((a) => a.classAverage)),
    },
    courses: analytics.map(({ rows, ...rest }) => rest),
    atRiskStudents: atRisk.sort((a, b) => b.risk.score - a.risk.score).slice(0, 10),
    upcomingSessions: upcoming,
    insights,
  });
});

const avg = (a) => (a.length ? Number((a.reduce((s, v) => s + v, 0) / a.length).toFixed(1)) : 0);

export const getCourseAnalytics = asyncHandler(async (req, res) => {
  res.json(await courseAnalytics(req.params.courseId));
});

export const getStudentAnalytics = asyncHandler(async (req, res) => {
  const { studentId, courseId } = req.params;
  if (req.user.role === 'student' && String(req.user._id) !== String(studentId)) {
    throw new AppError('You can only view your own analytics', 403);
  }
  res.json(await studentCourseAnalytics(studentId, courseId));
});

/** Public leaderboard for a course -- names only, no private metrics. */
export const scoreboard = asyncHandler(async (req, res) => {
  const analytics = await courseAnalytics(req.params.courseId);
  const isTeacher = req.user.role !== 'student';

  res.json({
    courseId: analytics.courseId,
    title: analytics.title,
    classAverage: analytics.classAverage,
    distribution: analytics.distribution,
    entries: analytics.scoreboard.map((e) => ({
      rank: e.rank,
      name: e.student.name,
      avatarUrl: e.student.avatarUrl,
      isMe: String(e.student.id) === String(req.user._id),
      grade: e.grade,
      letter: e.letter,
      attendance: e.attendance,
      ...(isTeacher ? { engagement: e.engagement, risk: e.risk, studentId: e.student.id } : {}),
    })),
  });
});

export const attendanceReport = asyncHandler(async (req, res) => {
  const { courseId } = req.params;
  const records = await Attendance.find({ course: courseId })
    .populate('student', 'name studentId')
    .populate('session', 'title scheduledStart')
    .lean();

  const bySession = new Map();
  for (const r of records) {
    const key = String(r.session?._id);
    if (!bySession.has(key)) {
      bySession.set(key, { session: r.session, present: 0, late: 0, partial: 0, absent: 0, records: [] });
    }
    const bucket = bySession.get(key);
    bucket[r.status] += 1;
    bucket.records.push({ student: r.student, status: r.status, engagement: r.engagementScore, minutes: r.minutesPresent });
  }

  res.json({ sessions: [...bySession.values()].sort((a, b) => new Date(b.session?.scheduledStart) - new Date(a.session?.scheduledStart)) });
});

export const listInsights = asyncHandler(async (req, res) => {
  const filter = { acknowledgedAt: null };
  if (req.user.role === 'student') {
    filter.scope = 'student';
    filter.student = req.user._id;
  } else if (req.query.courseId) {
    filter.course = req.query.courseId;
  } else {
    const courses = await Course.find({ teacher: req.user._id }).select('_id').lean();
    filter.course = { $in: courses.map((c) => c._id) };
  }

  const insights = await Insight.find(filter)
    .populate('course', 'title code')
    .populate('student', 'name avatarUrl')
    .sort({ createdAt: -1 })
    .limit(50)
    .lean();

  res.json({ insights });
});

export const acknowledgeInsight = asyncHandler(async (req, res) => {
  const insight = await Insight.findByIdAndUpdate(
    req.params.id, { acknowledgedAt: new Date() }, { new: true }
  );
  if (!insight) throw new AppError('Insight not found', 404);
  res.json({ insight });
});

/** Force a recompute -- normally triggered automatically after grading. */
export const regenerate = asyncHandler(async (req, res) => {
  res.json(await refreshCourse(req.params.courseId));
});
