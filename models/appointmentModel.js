import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';  // Using UUID to ensure uniqueness

const appointmentSchema = new mongoose.Schema({
  caseId: {
    type: String,
    //required: true,
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
  type: {
    type: String,
    enum: ['Follow up', 'Consultation', 'Vaccination', 'Other'],
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    //required: true,
  },
  tokenDate: {
    type: Date,
    required: true,
  },
  status: {
    type: String,
    enum: ['Scheduled', 'Ongoing', 'Waiting', 'Completed'],
    default: 'Scheduled',
  },
});

// Middleware to generate caseId before saving a new appointment

//check for repeated genearted ids from "UUID"
appointmentSchema.pre('save', function (next) {
  if (!this.caseId) {
    this.caseId = `CASE-${uuidv4()}`;  // Generates a unique ID in the format CASE-<UUID>
  }
  next();
});

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
