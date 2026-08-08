import mongoose from 'mongoose';

const courseSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true },
    description: String,
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    students: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true }],
    coverColor: { type: String, default: '#4f46e5' },
    credits: { type: Number, default: 3 },
    schedule: [{ day: String, startTime: String, endTime: String }],
    isArchived: { type: Boolean, default: false },
  },
  { timestamps: true }
);

export default mongoose.model('Course', courseSchema);
