import mongoose from 'mongoose';
import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Attendance from '../models/Attendance.js';
import Course from '../models/Course.js';
import { attendanceRateFor } from './attendanceService.js';

const oid = (v) => new mongoose.Types.ObjectId(String(v));

/** Weighted course grade: sum(score/max * weight) / sum(weight). */
export async function gradeFor(studentId, courseId) {
  const assignments = await Assignment.find({ course: courseId, isPublished: true }).lean();
  if (!assignments.length) return { percent: 0, graded: 0, total: 0, missing: 0, letter: 'N/A' };

  const submissions = await Submission.find({
    student: studentId,
    assignment: { $in: assignments.map((a) => a._id) },
  }).lean();

  const byAssignment = new Map(submissions.map((s) => [String(s.assignment), s]));

  let weightedSum = 0;
  let weightTotal = 0;
  let graded = 0;
  let missing = 0;
  const now = Date.now();

  for (const a of assignments) {
    const sub = byAssignment.get(String(a._id));
    const isPastDue = new Date(a.dueDate).getTime() < now;

    if (sub && sub.score != null) {
      weightedSum += (sub.score / a.maxScore) * a.weight;
      weightTotal += a.weight;
      graded += 1;
    } else if (!sub && isPastDue) {
      // An un-submitted past-due assignment counts as a zero -- otherwise a
      // student who submits nothing shows a perfect average.
      weightTotal += a.weight;
      missing += 1;
    }
  }

  const percent = weightTotal ? Number(((weightedSum / weightTotal) * 100).toFixed(2)) : 0;
  return { percent, graded, total: assignments.length, missing, letter: toLetter(percent) };
}

export function toLetter(percent) {
  if (percent >= 90) return 'A';
  if (percent >= 80) return 'B';
  if (percent >= 70) return 'C';
  if (percent >= 60) return 'D';
  return 'F';
}

/** Least-squares slope over chronologically ordered scores (% per assignment). */
export function trendSlope(points) {
  const n = points.length;
  if (n < 2) return 0;
  const meanX = (n - 1) / 2;
  const meanY = points.reduce((s, p) => s + p, 0) / n;
  let num = 0;
  let den = 0;
  points.forEach((y, x) => {
    num += (x - meanX) * (y - meanY);
    den += (x - meanX) ** 2;
  });
  return den ? Number((num / den).toFixed(3)) : 0;
}

/** Chronological normalised scores for one student in one course. */
export async function scoreTimeline(studentId, courseId) {
  const subs = await Submission.find({ student: studentId, course: courseId, score: { $ne: null } })
    .populate('assignment', 'title maxScore dueDate')
    .sort({ createdAt: 1 })
    .lean();

  return subs
    .filter((s) => s.assignment)
    .map((s) => ({
      assignment: s.assignment.title,
      date: s.assignment.dueDate,
      percent: Number(((s.score / s.assignment.maxScore) * 100).toFixed(1)),
      isLate: s.isLate,
    }));
}

/**
 * Risk model. A transparent weighted-signal score rather than a black box, so
 * teachers can see exactly why a student was flagged.
 */
export function riskScore({ attendanceRate, gradePercent, engagement, missing, slope, lateRatio }) {
  // Each signal is normalised so that 0 == healthy and 1 == the point where
  // the signal alone would justify intervention. Denominators are calibrated
  // against the thresholds teachers actually act on (85% attendance, 75% grade).
  const signals = [
    { name: 'attendance', weight: 0.30, value: clamp01((85 - attendanceRate) / 60) },
    { name: 'grade', weight: 0.30, value: clamp01((75 - gradePercent) / 50) },
    { name: 'engagement', weight: 0.15, value: clamp01((65 - engagement) / 50) },
    { name: 'missing-work', weight: 0.15, value: clamp01(missing / 4) },
    { name: 'trend', weight: 0.05, value: clamp01(-slope / 8) },
    { name: 'lateness', weight: 0.05, value: clamp01(lateRatio) },
  ];

  const score = Number((signals.reduce((s, x) => s + x.weight * x.value, 0) * 100).toFixed(1));
  const level = score >= 60 ? 'high' : score >= 35 ? 'medium' : 'low';
  const drivers = signals
    .filter((s) => s.value > 0.35)
    .sort((a, b) => b.weight * b.value - a.weight * a.value)
    .map((s) => s.name);

  return { score, level, drivers, signals };
}

const clamp01 = (v) => Math.max(0, Math.min(1, v));

/** Everything one student's dashboard needs for one course. */
export async function studentCourseAnalytics(studentId, courseId) {
  const [attendance, grade, timeline, lateStats] = await Promise.all([
    attendanceRateFor(studentId, courseId),
    gradeFor(studentId, courseId),
    scoreTimeline(studentId, courseId),
    Submission.aggregate([
      { $match: { student: oid(studentId), course: oid(courseId) } },
      { $group: { _id: null, total: { $sum: 1 }, late: { $sum: { $cond: ['$isLate', 1, 0] } } } },
    ]),
  ]);

  const slope = trendSlope(timeline.map((t) => t.percent));
  const lateRatio = lateStats[0]?.total ? lateStats[0].late / lateStats[0].total : 0;

  const risk = riskScore({
    attendanceRate: attendance.rate,
    gradePercent: grade.percent,
    engagement: attendance.avgEngagement,
    missing: grade.missing,
    slope,
    lateRatio,
  });

  return { courseId, attendance, grade, timeline, slope, lateRatio: Number(lateRatio.toFixed(2)), risk };
}

/** Aggregate view across every course a student is enrolled in. */
export async function studentOverview(studentId) {
  const courses = await Course.find({ students: studentId, isArchived: false })
    .select('title code coverColor teacher')
    .populate('teacher', 'name')
    .lean();

  const perCourse = await Promise.all(
    courses.map(async (c) => ({
      course: { id: c._id, title: c.title, code: c.code, coverColor: c.coverColor, teacher: c.teacher?.name },
      ...(await studentCourseAnalytics(studentId, c._id)),
    }))
  );

  const gpaBase = perCourse.filter((c) => c.grade.graded > 0);
  const overallGrade = gpaBase.length
    ? Number((gpaBase.reduce((s, c) => s + c.grade.percent, 0) / gpaBase.length).toFixed(1))
    : 0;
  const overallAttendance = perCourse.length
    ? Number((perCourse.reduce((s, c) => s + c.attendance.rate, 0) / perCourse.length).toFixed(1))
    : 0;

  return {
    overallGrade,
    overallAttendance,
    letter: toLetter(overallGrade),
    highestRisk: perCourse.reduce((m, c) => (c.risk.score > (m?.risk.score ?? -1) ? c : m), null),
    courses: perCourse,
  };
}

/** Teacher-facing roll-up for one course, including a ranked class list. */
export async function courseAnalytics(courseId) {
  const course = await Course.findById(courseId).populate('students', 'name email studentId avatarUrl').lean();
  if (!course) throw new Error('Course not found');

  const rows = await Promise.all(
    course.students.map(async (s) => ({
      student: { id: s._id, name: s.name, email: s.email, studentId: s.studentId, avatarUrl: s.avatarUrl },
      ...(await studentCourseAnalytics(s._id, courseId)),
    }))
  );

  const grades = rows.map((r) => r.grade.percent);
  const scoreboard = [...rows]
    .sort((a, b) => b.grade.percent - a.grade.percent)
    .map((r, i) => ({
      rank: i + 1,
      student: r.student,
      grade: r.grade.percent,
      letter: r.grade.letter,
      attendance: r.attendance.rate,
      engagement: r.attendance.avgEngagement,
      risk: r.risk.level,
    }));

  return {
    courseId,
    title: course.title,
    code: course.code,
    studentCount: course.students.length,
    classAverage: avg(grades),
    median: median(grades),
    distribution: distribution(grades),
    atRisk: rows.filter((r) => r.risk.level !== 'low').length,
    averageAttendance: avg(rows.map((r) => r.attendance.rate)),
    averageEngagement: avg(rows.map((r) => r.attendance.avgEngagement)),
    scoreboard,
    rows,
  };
}

const avg = (a) => (a.length ? Number((a.reduce((s, v) => s + v, 0) / a.length).toFixed(1)) : 0);

function median(a) {
  if (!a.length) return 0;
  const s = [...a].sort((x, y) => x - y);
  const mid = Math.floor(s.length / 2);
  return Number((s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2).toFixed(1));
}

function distribution(grades) {
  const buckets = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  grades.forEach((g) => { buckets[toLetter(g)] += 1; });
  return buckets;
}

/** Per-assignment difficulty analysis -- highlights questions the class missed. */
export async function assignmentAnalytics(assignmentId) {
  const assignment = await Assignment.findById(assignmentId).lean();
  if (!assignment) throw new Error('Assignment not found');

  const subs = await Submission.find({ assignment: assignmentId }).lean();
  const scored = subs.filter((s) => s.score != null).map((s) => (s.score / assignment.maxScore) * 100);

  const enrolled = await Course.findById(assignment.course).select('students').lean();
  const total = enrolled?.students?.length || 0;

  return {
    assignmentId,
    title: assignment.title,
    submitted: subs.length,
    notSubmitted: Math.max(0, total - subs.length),
    graded: scored.length,
    average: avg(scored),
    median: median(scored),
    lateCount: subs.filter((s) => s.isLate).length,
    distribution: distribution(scored),
    difficulty: scored.length ? (avg(scored) < 60 ? 'hard' : avg(scored) < 80 ? 'moderate' : 'easy') : 'unknown',
  };
}
