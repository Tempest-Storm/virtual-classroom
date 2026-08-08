import mongoose from 'mongoose';

export const ATTENDANCE_STATUS = ['present', 'late', 'partial', 'absent'];

/**
 * One document per (session, student). The AI pipeline appends face-recognition
 * samples during the class; a status is derived from presence ratio + join time.
 */
const attendanceSchema = new mongoose.Schema(
  {
    session: { type: mongoose.Schema.Types.ObjectId, ref: 'ClassSession', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    status: { type: String, enum: ATTENDANCE_STATUS, default: 'absent', index: true },
    joinedAt: Date,
    leftAt: Date,

    // AI signals
    recognisedSamples: { type: Number, default: 0 },
    totalSamples: { type: Number, default: 0 },
    presenceRatio: { type: Number, default: 0 },      // recognised / total
    avgConfidence: { type: Number, default: 0 },      // 1 - euclidean distance
    engagementScore: { type: Number, default: 0 },    // 0..100, gaze/activity blend
    minutesPresent: { type: Number, default: 0 },

    method: { type: String, enum: ['ai-face', 'manual', 'override'], default: 'ai-face' },
    overriddenBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    overrideReason: String,
    flags: [{ type: String }], // e.g. 'low-confidence', 'multiple-faces', 'no-camera'
  },
  { timestamps: true }
);

attendanceSchema.index({ session: 1, student: 1 }, { unique: true });

export default mongoose.model('Attendance', attendanceSchema);
