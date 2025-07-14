import mongoose from 'mongoose';
const vitalsSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  heartRate: String,
  temperature: String,
  bloodPressure: String,
  spo2: String,
  recordedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Vitals', vitalsSchema);