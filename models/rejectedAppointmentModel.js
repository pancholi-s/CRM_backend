import mongoose from 'mongoose';

const rejectedAppointmentSchema = new mongoose.Schema({
  caseId: {
    type: String,
    unique: true,
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
    required: true,
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: true,
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
  },
  tokenDate: {
    type: Date,
    required: true,
  },
  dateRejected: {
    type: Date,
    default: Date.now,
  },
});

export default mongoose.model('RejectedAppointment', rejectedAppointmentSchema);
