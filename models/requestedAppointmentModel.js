import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';

const requestedAppointmentSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: true,
    unique: true,
    default: () => `CASE-${uuidv4()}`, // Automatically generated
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
  type: {
    type: String,
    enum: ['Follow up', 'Consultation', 'Vaccination', 'Other'],
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  tokenDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['Pending'],
    default: 'Pending',
  },
  note: {
    type: String,
  },
});

export default mongoose.model('RequestedAppointment', requestedAppointmentSchema);

