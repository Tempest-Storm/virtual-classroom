import Insight from '../models/Insight.js';
import Course from '../models/Course.js';
import { studentCourseAnalytics, courseAnalytics } from './analyticsService.js';

/**
 * Turns raw analytics into plain-language, actionable insights. Rules are
 * explicit and auditable -- every card a teacher sees can be traced back to
 * the metrics that produced it.
 */
const RULES = [
  {
    kind: 'at-risk',
    severity: 'critical',
    when: (a) => a.risk.level === 'high',
    build: (a) => ({
      title: 'At risk of falling behind',
      message: `Risk score ${a.risk.score}/100, driven by ${a.risk.drivers.join(', ') || 'multiple factors'}. Attendance ${a.attendance.rate}%, grade ${a.grade.percent}%.`,
      recommendation: 'Schedule a 1:1 check-in this week and share catch-up material for the missed sessions.',
    }),
  },
  {
    kind: 'attendance-drop',
    severity: 'warning',
    when: (a) => a.attendance.total >= 3 && a.attendance.rate < 70,
    build: (a) => ({
      title: 'Attendance below threshold',
      message: `Attended ${a.attendance.attended} of ${a.attendance.total} sessions (${a.attendance.rate}%).`,
      recommendation: 'Send recordings for missed classes and confirm there is no connectivity or scheduling conflict.',
    }),
  },
  {
    kind: 'low-engagement',
    severity: 'warning',
    when: (a) => a.attendance.total >= 3 && a.attendance.avgEngagement < 55 && a.attendance.rate >= 70,
    build: (a) => ({
      title: 'Present but disengaged',
      message: `Attendance is healthy (${a.attendance.rate}%) but average engagement is only ${a.attendance.avgEngagement}/100.`,
      recommendation: 'Use breakout rooms or direct questions to pull this student into the discussion.',
    }),
  },
  {
    kind: 'missing-work',
    severity: 'warning',
    when: (a) => a.grade.missing >= 2,
    build: (a) => ({
      title: `${a.grade.missing} assignments not submitted`,
      message: `Un-submitted past-due work is counting as zero and pulling the grade to ${a.grade.percent}%.`,
      recommendation: 'Offer a short extension window to recover the missing submissions.',
    }),
  },
  {
    kind: 'declining',
    severity: 'warning',
    when: (a) => a.slope <= -4 && a.timeline.length >= 3,
    build: (a) => ({
      title: 'Downward score trend',
      message: `Scores are dropping about ${Math.abs(a.slope)} points per assignment across ${a.timeline.length} graded items.`,
      recommendation: 'Review the most recent topic -- the decline usually starts at one specific concept.',
    }),
  },
  {
    kind: 'improving',
    severity: 'info',
    when: (a) => a.slope >= 4 && a.timeline.length >= 3,
    build: (a) => ({
      title: 'Improving steadily',
      message: `Scores are up about ${a.slope} points per assignment. Currently at ${a.grade.percent}%.`,
      recommendation: 'Acknowledge the progress -- positive reinforcement sustains the trend.',
    }),
  },
  {
    kind: 'top-performer',
    severity: 'info',
    when: (a) => a.grade.percent >= 90 && a.attendance.rate >= 90,
    build: (a) => ({
      title: 'Consistently excellent',
      message: `Grade ${a.grade.percent}% with ${a.attendance.rate}% attendance.`,
      recommendation: 'Consider offering stretch work or a peer-mentoring role.',
    }),
  },
  {
    kind: 'chronic-lateness',
    severity: 'info',
    when: (a) => a.lateRatio >= 0.4,
    build: (a) => ({
      title: 'Frequently submits late',
      message: `${Math.round(a.lateRatio * 100)}% of submissions arrived after the deadline.`,
      recommendation: 'Late penalties are eroding otherwise solid work -- discuss time management.',
    }),
  },
];

/** Regenerate insights for one student in one course. */
export async function generateStudentInsights(studentId, courseId) {
  const analytics = await studentCourseAnalytics(studentId, courseId);

  const produced = RULES.filter((r) => {
    try { return r.when(analytics); } catch { return false; }
  }).map((r) => ({ ...r.build(analytics), kind: r.kind, severity: r.severity }));

  await Insight.deleteMany({ scope: 'student', student: studentId, course: courseId, acknowledgedAt: null });

  if (!produced.length) return [];

  return Insight.insertMany(
    produced.map((p) => ({
      scope: 'student',
      student: studentId,
      course: courseId,
      kind: p.kind,
      severity: p.severity,
      title: p.title,
      message: p.message,
      recommendation: p.recommendation,
      metrics: {
        attendanceRate: analytics.attendance.rate,
        gradePercent: analytics.grade.percent,
        engagement: analytics.attendance.avgEngagement,
        riskScore: analytics.risk.score,
        slope: analytics.slope,
      },
    }))
  );
}

/** Course-level insights for the teacher dashboard. */
export async function generateCourseInsights(courseId) {
  const a = await courseAnalytics(courseId);
  const cards = [];

  if (a.classAverage < 65 && a.studentCount >= 3) {
    cards.push({
      kind: 'class-underperforming',
      severity: 'critical',
      title: 'Class average below passing',
      message: `Average is ${a.classAverage}% (median ${a.median}%) across ${a.studentCount} students.`,
      recommendation: 'The issue is likely the material rather than individuals -- consider a revision session.',
    });
  }

  if (a.atRisk / Math.max(1, a.studentCount) >= 0.25) {
    cards.push({
      kind: 'cohort-risk',
      severity: 'warning',
      title: `${a.atRisk} students flagged at risk`,
      message: `${Math.round((a.atRisk / a.studentCount) * 100)}% of the cohort is showing medium or high risk signals.`,
      recommendation: 'Review the scoreboard and prioritise the highest-risk students for outreach.',
    });
  }

  if (a.averageAttendance < 75) {
    cards.push({
      kind: 'attendance-drop',
      severity: 'warning',
      title: 'Course attendance is slipping',
      message: `Average attendance is ${a.averageAttendance}%.`,
      recommendation: 'Check whether the scheduled time still works for the cohort.',
    });
  }

  if (a.averageEngagement && a.averageEngagement < 60) {
    cards.push({
      kind: 'low-engagement',
      severity: 'info',
      title: 'Engagement is low during live classes',
      message: `Average engagement score is ${a.averageEngagement}/100.`,
      recommendation: 'Add more interactive segments -- polls, breakouts, or live Q&A.',
    });
  }

  await Insight.deleteMany({ scope: 'course', course: courseId, acknowledgedAt: null });
  if (!cards.length) return [];

  return Insight.insertMany(cards.map((c) => ({ ...c, scope: 'course', course: courseId, metrics: {
    classAverage: a.classAverage, averageAttendance: a.averageAttendance, atRisk: a.atRisk,
  } })));
}

/** Refresh every insight for a course -- run after grading or a session ends. */
export async function refreshCourse(courseId) {
  const course = await Course.findById(courseId).select('students').lean();
  if (!course) return { students: 0, insights: 0 };

  let count = 0;
  for (const studentId of course.students) {
    const made = await generateStudentInsights(studentId, courseId);
    count += made.length;
  }
  const courseCards = await generateCourseInsights(courseId);
  return { students: course.students.length, insights: count + courseCards.length };
}
