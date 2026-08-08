import Course from '../models/Course.js';
import User from '../models/User.js';
import ClassSession from '../models/ClassSession.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { invalidateRoster } from '../services/attendanceService.js';

export const listCourses = asyncHandler(async (req, res) => {
  const filter = { isArchived: false };
  if (req.user.role === 'teacher') filter.teacher = req.user._id;
  else if (req.user.role === 'student') filter.students = req.user._id;

  const courses = await Course.find(filter)
    .populate('teacher', 'name email avatarUrl')
    .sort({ createdAt: -1 })
    .lean();

  const withCounts = courses.map((c) => ({ ...c, studentCount: c.students?.length || 0 }));
  res.json({ courses: withCounts });
});

export const getCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id)
    .populate('teacher', 'name email avatarUrl')
    .populate('students', 'name email studentId avatarUrl faceEnrolledAt');
  if (!course) throw new AppError('Course not found', 404);

  const upcoming = await ClassSession.find({ course: course._id, status: { $in: ['scheduled', 'live'] } })
    .sort({ scheduledStart: 1 })
    .limit(5)
    .lean();

  res.json({ course, upcomingSessions: upcoming });
});

export const createCourse = asyncHandler(async (req, res) => {
  const course = await Course.create({ ...req.body, teacher: req.user._id });
  res.status(201).json({ course });
});

export const updateCourse = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw new AppError('Course not found', 404);
  if (String(course.teacher) !== String(req.user._id) && req.user.role !== 'admin') {
    throw new AppError('Only the course teacher can edit this course', 403);
  }

  ['title', 'description', 'coverColor', 'credits', 'schedule', 'isArchived'].forEach((k) => {
    if (req.body[k] !== undefined) course[k] = req.body[k];
  });
  await course.save();
  res.json({ course });
});

/** Students self-enrol with the course code; teachers can add by email. */
export const enrol = asyncHandler(async (req, res) => {
  const { code, email } = req.body;
  const course = code
    ? await Course.findOne({ code: String(code).toUpperCase() })
    : await Course.findById(req.params.id);
  if (!course) throw new AppError('Course not found', 404);

  let studentId = req.user._id;
  if (email) {
    if (req.user.role === 'student') throw new AppError('Students may only enrol themselves', 403);
    const student = await User.findOne({ email: String(email).toLowerCase(), role: 'student' });
    if (!student) throw new AppError('No student account with that email', 404);
    studentId = student._id;
  }

  if (course.students.some((s) => String(s) === String(studentId))) {
    throw new AppError('Already enrolled in this course', 409);
  }

  course.students.push(studentId);
  await course.save();
  invalidateRoster(course._id);

  res.json({ message: 'Enrolled', course: { id: course._id, title: course.title, code: course.code } });
});

export const unenrol = asyncHandler(async (req, res) => {
  const course = await Course.findById(req.params.id);
  if (!course) throw new AppError('Course not found', 404);

  const target = req.body.studentId || req.user._id;
  if (String(target) !== String(req.user._id) && req.user.role === 'student') {
    throw new AppError('Not permitted', 403);
  }

  course.students = course.students.filter((s) => String(s) !== String(target));
  await course.save();
  invalidateRoster(course._id);

  res.json({ message: 'Removed from course' });
});
