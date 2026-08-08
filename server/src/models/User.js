import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

export const ROLES = ['student', 'teacher', 'admin'];

const userSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, index: true },
    password: { type: String, required: true, minlength: 8, select: false },
    role: { type: String, enum: ROLES, default: 'student', index: true },
    avatarUrl: String,
    studentId: { type: String, sparse: true, index: true },
    department: String,

    // Face enrolment: 128-d descriptors captured from several angles.
    // Raw images are never stored -- only irreversible embeddings.
    faceDescriptors: { type: [[Number]], default: [], select: false },
    faceEnrolledAt: Date,

    lastLoginAt: Date,
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true }
);

userSchema.virtual('faceEnrolled').get(function () {
  return Boolean(this.faceEnrolledAt);
});

userSchema.set('toJSON', { virtuals: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = function (candidate) {
  return bcrypt.compare(candidate, this.password);
};

export default mongoose.model('User', userSchema);
