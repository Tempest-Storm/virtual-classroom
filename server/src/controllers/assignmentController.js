import Assignment from '../models/Assignment.js';
import Submission from '../models/Submission.js';
import Course from '../models/Course.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { assignmentAnalytics } from '../services/analyticsService.js';
import { generateStudentInsights } from '../services/insightService.js';

export const listAssignments = asyncHandler(async (req, res) => {
  const filter = {};
  if (req.query.courseId) filter.course = req.query.courseId;

  if (req.user.role === 'student') {
    const courses = await Course.find({ students: req.user._id }).select('_id').lean();
    filter.course = req.query.courseId || { $in: courses.map((c) => c._id) };
    filter.isPublished = true;
  } else if (req.user.role === 'teacher' && !req.query.courseId) {
    filter.teacher = req.user._id;
  }

  const assignments = await Assignment.find(filter)
    .populate('course', 'title code coverColor')
    .sort({ dueDate: 1 })
    .lean();

  // Students see their own submission status inline.
  if (req.user.role === 'student') {
    const subs = await Submission.find({
      student: req.user._id,
      assignment: { $in: assignments.map((a) => a._id) },
    }).lean();
    const byId = new Map(subs.map((s) => [String(s.assignment), s]));

    return res.json({
      assignments: assignments.map((a) => {
        const sub = byId.get(String(a._id));
        return {
          ...a,
          submission: sub || null,
          submissionStatus: sub
            ? sub.score != null ? 'graded' : 'submitted'
            : new Date(a.dueDate) < new Date() ? 'missing' : 'pending',
        };
      }),
    });
  }

  const counts = await Submission.aggregate([
    { $match: { assignment: { $in: assignments.map((a) => a._id) } } },
    { $group: { _id: '$assignment', submitted: { $sum: 1 }, graded: { $sum: { $cond: [{ $ne: ['$score', null] }, 1, 0] } } } },
  ]);
  const countBy = new Map(counts.map((c) => [String(c._id), c]));

  res.json({
    assignments: assignments.map((a) => ({
      ...a,
      submitted: countBy.get(String(a._id))?.submitted || 0,
      graded: countBy.get(String(a._id))?.graded || 0,
    })),
  });
});

export const createAssignment = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.body.course).select('teacher').lean();
  if (!course) throw new AppError('Course not found', 404);
  if (String(course.teacher) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new AppError('Only the course teacher can create assignments', 403);
  }

  const assignment = await Assignment.create({
    ...req.body,
    teacher: req.user._id,
    attachments: (req.files || []).map((f) => ({ name: f.originalname, url: `/uploads/${f.filename}` })),
  });

  req.io?.to(`course:${assignment.course}`).emit('assignment:created', {
    id: String(assignment._id), title: assignment.title, dueDate: assignment.dueDate,
  });

  res.status(201).json({ assignment });
});

export const getAssignment = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id).populate('course', 'title code').lean();
  if (!assignment) throw new AppError('Assignment not found', 404);

  if (req.user.role === 'student') {
    const submission = await Submission.findOne({ assignment: assignment._id, student: req.user._id }).lean();
    return res.json({ assignment, submission });
  }

  const submissions = await Submission.find({ assignment: assignment._id })
    .populate('student', 'name email studentId avatarUrl')
    .sort({ submittedAt: -1 })
    .lean();

  res.json({ assignment, submissions, analytics: await assignmentAnalytics(assignment._id) });
});

export const submit = asyncHandler(async (req, res) => {
  const assignment = await Assignment.findById(req.params.id);
  if (!assignment) throw new AppError('Assignment not found', 404);

  const isLate = new Date() > new Date(assignment.dueDate);
  if (isLate && !assignment.allowLate) throw new AppError('The deadline for this assignment has passed', 409);

  const submission = await Submission.findOneAndUpdate(
    { assignment: assignment._id, student: req.user._id },
    {
      $set: {
        course: assignment.course,
        text: req.body.text,
        submittedAt: new Date(),
        isLate,
        status: 'submitted',
        score: null,
        gradedAt: null,
        ...( (req.files || []).length
          ? { files: req.files.map((f) => ({ name: f.originalname, url: `/uploads/${f.filename}`, size: f.size })) }
          : {}),
      },
    },
    { new: true, upsert: true, setDefaultsOnInsert: true }
  );

  res.status(201).json({ submission, isLate });
});

export const grade = asyncHandler(async (req, res) => {
  const { score, feedback } = req.body;
  const submission = await Submission.findById(req.params.submissionId).populate('assignment');
  if (!submission) throw new AppError('Submission not found', 404);

  const assignment = submission.assignment;
  if (String(assignment.teacher) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new AppError('Only the course teacher can grade this', 403);
  }

  const raw = Number(score);
  if (Number.isNaN(raw) || raw < 0 || raw > assignment.maxScore) {
    throw new AppError(`Score must be between 0 and ${assignment.maxScore}`);
  }

  const penalty = submission.isLate ? (assignment.latePenaltyPercent || 0) / 100 : 0;
  submission.rawScore = raw;
  submission.score = Number((raw * (1 - penalty)).toFixed(2));
  submission.feedback = feedback;
  submission.gradedAt = new Date();
  submission.gradedBy = req.user._id;
  submission.status = 'graded';
  await submission.save();

  // A new grade shifts this student's analytics, so refresh their insights.
  await generateStudentInsights(submission.student, submission.course);

  req.io?.to(`user:${submission.student}`).emit('submission:graded', {
    assignment: assignment.title,
    score: submission.score,
    maxScore: assignment.maxScore,
  });

  res.json({ submission });
});
