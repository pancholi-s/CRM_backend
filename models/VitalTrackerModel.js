import mongoose from 'mongoose';
const vitalsSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  recordedBy: { type: String, required: true },
  vitals: { type: mongoose.Schema.Types.Mixed, required: true },
  recordedAt: { type: Date, default: Date.now}, 
  caseId: {type: String, required: true}
});

export default mongoose.model('Vitals', vitalsSchema);