import { z } from 'zod';
import User from '../models/User.js';
import { signToken } from '../middleware/auth.js';
import { asyncHandler, AppError } from '../middleware/error.js';
import { isValidDescriptor, centroid } from '../services/faceService.js';
import { invalidateRoster } from '../services/attendanceService.js';
import Course from '../models/Course.js';

const registerSchema = z.object({
  name: z.string().min(2).max(80),
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  role: z.enum(['student', 'teacher']).default('student'),
  studentId: z.string().optional(),
  department: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

const sanitize = (user) => {
  const obj = user.toJSON();
  delete obj.password;
  delete obj.faceDescriptors;
  return obj;
};

export const register = asyncHandler(async (req, res) => {
  const data = registerSchema.parse(req.body);

  if (await User.exists({ email: data.email.toLowerCase() })) {
    throw new AppError('An account with that email already exists', 409);
  }

  const user = await User.create(data);
  res.status(201).json({ token: signToken(user), user: sanitize(user) });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = loginSchema.parse(req.body);

  const user = await User.findOne({ email: email.toLowerCase() }).select('+password');
  if (!user || !(await user.comparePassword(password))) {
    throw new AppError('Incorrect email or password', 401);
  }
  if (!user.isActive) throw new AppError('This account has been deactivated', 403);

  user.lastLoginAt = new Date();
  await user.save({ validateBeforeSave: false });

  res.json({ token: signToken(user), user: sanitize(user) });
});

export const me = asyncHandler(async (req, res) => {
  res.json({ user: sanitize(req.user) });
});

export const updateProfile = asyncHandler(async (req, res) => {
  const allowed = ['name', 'avatarUrl', 'department', 'studentId'];
  allowed.forEach((k) => {
    if (req.body[k] !== undefined) req.user[k] = req.body[k];
  });
  await req.user.save();
  res.json({ user: sanitize(req.user) });
});

export const changePassword = asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) throw new AppError('New password must be at least 8 characters');

  const user = await User.findById(req.user._id).select('+password');
  if (!(await user.comparePassword(currentPassword || ''))) {
    throw new AppError('Current password is incorrect', 401);
  }

  user.password = newPassword;
  await user.save();
  res.json({ message: 'Password updated', token: signToken(user) });
});

/**
 * Face enrolment. The client captures several frames, extracts 128-d
 * descriptors locally, and posts only the vectors.
 */
export const enrolFace = asyncHandler(async (req, res) => {
  const descriptors = req.body.descriptors;
  if (!Array.isArray(descriptors) || descriptors.length < 3) {
    throw new AppError('At least 3 face samples are required for reliable recognition');
  }
  if (!descriptors.every(isValidDescriptor)) {
    throw new AppError('Each sample must be a 128-dimension descriptor');
  }

  const user = await User.findById(req.user._id).select('+faceDescriptors');
  // Keep the individual samples plus a centroid; the centroid stabilises
  // matching when the raw samples were captured under uneven lighting.
  user.faceDescriptors = [...descriptors, centroid(descriptors)];
  user.faceEnrolledAt = new Date();
  await user.save();

  const courses = await Course.find({ students: user._id }).select('_id').lean();
  courses.forEach((c) => invalidateRoster(c._id));

  res.json({ message: 'Face enrolment complete', samples: descriptors.length, enrolledAt: user.faceEnrolledAt });
});

export const deleteFaceData = asyncHandler(async (req, res) => {
  const user = await User.findById(req.user._id).select('+faceDescriptors');
  user.faceDescriptors = [];
  user.faceEnrolledAt = undefined;
  await user.save();

  const courses = await Course.find({ students: user._id }).select('_id').lean();
  courses.forEach((c) => invalidateRoster(c._id));

  res.json({ message: 'Face data deleted. Attendance will fall back to manual marking.' });
});
