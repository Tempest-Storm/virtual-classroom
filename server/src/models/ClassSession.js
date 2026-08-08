import mongoose from 'mongoose';

export const SESSION_STATUS = ['scheduled', 'live', 'ended', 'cancelled'];

const classSessionSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    topic: String,
    scheduledStart: { type: Date, required: true, index: true },
    scheduledEnd: { type: Date, required: true },
    actualStart: Date,
    actualEnd: Date,
    status: { type: String, enum: SESSION_STATUS, default: 'scheduled', index: true },

    roomId: { type: String, required: true, unique: true, index: true },
    isRecorded: { type: Boolean, default: false },
    recordingUrl: String,
    recordingDurationSec: Number,
    materials: [{ name: String, url: String, mimeType: String }],
  },
  { timestamps: true }
);

classSessionSchema.virtual('durationMinutes').get(function () {
  const start = this.actualStart || this.scheduledStart;
  const end = this.actualEnd || this.scheduledEnd;
  return Math.max(0, Math.round((end - start) / 60000));
});

classSessionSchema.set('toJSON', { virtuals: true });

export default mongoose.model('ClassSession', classSessionSchema);
