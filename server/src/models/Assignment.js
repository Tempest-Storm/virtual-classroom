import mongoose from 'mongoose';

const assignmentSchema = new mongoose.Schema(
  {
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    teacher: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, required: true },
    instructions: String,
    type: { type: String, enum: ['homework', 'quiz', 'project', 'exam'], default: 'homework' },
    maxScore: { type: Number, default: 100, min: 1 },
    weight: { type: Number, default: 1, min: 0 },     // weighting inside the course grade
    dueDate: { type: Date, required: true, index: true },
    allowLate: { type: Boolean, default: true },
    latePenaltyPercent: { type: Number, default: 10 },
    attachments: [{ name: String, url: String }],
    isPublished: { type: Boolean, default: true },
  },
  { timestamps: true }
);

export default mongoose.model('Assignment', assignmentSchema);
