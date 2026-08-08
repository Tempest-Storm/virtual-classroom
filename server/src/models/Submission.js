import mongoose from 'mongoose';

const submissionSchema = new mongoose.Schema(
  {
    assignment: { type: mongoose.Schema.Types.ObjectId, ref: 'Assignment', required: true, index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },

    text: String,
    files: [{ name: String, url: String, size: Number }],
    submittedAt: { type: Date, default: Date.now },
    isLate: { type: Boolean, default: false },

    score: { type: Number, min: 0 },
    rawScore: { type: Number, min: 0 },  // before late penalty
    feedback: String,
    gradedAt: Date,
    gradedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
    status: { type: String, enum: ['submitted', 'graded', 'returned'], default: 'submitted', index: true },
  },
  { timestamps: true }
);

submissionSchema.index({ assignment: 1, student: 1 }, { unique: true });

export default mongoose.model('Submission', submissionSchema);
