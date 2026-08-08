import mongoose from 'mongoose';

/** AI-generated observations surfaced on dashboards. */
const insightSchema = new mongoose.Schema(
  {
    scope: { type: String, enum: ['student', 'course'], required: true, index: true },
    student: { type: mongoose.Schema.Types.ObjectId, ref: 'User', index: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', index: true },

    kind: { type: String, required: true },   // 'at-risk' | 'improving' | 'attendance-drop' | ...
    severity: { type: String, enum: ['info', 'warning', 'critical'], default: 'info', index: true },
    title: { type: String, required: true },
    message: { type: String, required: true },
    recommendation: String,
    metrics: { type: mongoose.Schema.Types.Mixed },
    acknowledgedAt: Date,
  },
  { timestamps: true }
);

insightSchema.index({ createdAt: -1 });

export default mongoose.model('Insight', insightSchema);
