import mongoose from 'mongoose';

const dischargeSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  admissionDate: { type: Date, required: true },
  dischargeDate: { type: Date, required: true },
  onAdmissionNotes: { type: String },
  onDischargeNotes: { type: String },
  diagnosis: { type: String },
  followUpDay: { type: String },
  followUpTime: { type: String },
  createdAt: { type: Date, default: Date.now },
  caseId: { type: String, required: true },
});

export default mongoose.model('Discharge', dischargeSchema);