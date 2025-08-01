// models/ProgressPhase.js
import mongoose from 'mongoose';

const progressPhaseSchema = new mongoose.Schema({
  caseId: { type: String, required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  title: { type: String, required: true },
  date: { type: Date, default: Date.now },
  assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  isDone: { type: Boolean, default: false },
  isFinal: { type: Boolean, default: false },
  description: { type: String },
  files: [{ type: String }], // file URLs
  consultation: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Consultation',
    },
  ],
}, { timestamps: true });

export default mongoose.model('ProgressPhase', progressPhaseSchema);
