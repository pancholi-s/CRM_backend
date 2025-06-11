import mongoose from 'mongoose';

const consultationSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  consultationData: { type: mongoose.Schema.Types.Mixed, required: true }, // dynamic JSON
  date: { type: Date, default: Date.now }
});

export default mongoose.model('Consultation', consultationSchema);
