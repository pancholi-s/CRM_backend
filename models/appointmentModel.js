import mongoose from 'mongoose';
import { v4 as uuidv4 } from 'uuid';  // Using UUID to ensure uniqueness

const appointmentSchema = new mongoose.Schema({
  caseId: {
    type: String,
    required: true,
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
    ref: "Hospital",
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
    enum: ['Scheduled', 'Ongoing', 'Waiting', 'Completed'],
    default: 'Scheduled',
  },
  note: {
    type: String
  }, // Doctor's notes for billing
});

// Middleware to generate caseId before saving a new appointment
appointmentSchema.pre('save', async function (next) {
  const Appointment = mongoose.model('Appointment'); // Access the Appointment model

  // Ensure caseId is generated only for NEW appointments
  if (!this.caseId) {
    let unique = false; // Flag to track uniqueness
    let newCaseId;

    // Keep generating new UUID until a unique caseId is found
    while (!unique) {
      newCaseId = `CASE-${uuidv4()}`; // Generate a new UUID

      // Check if the generated caseId already exists
      const existingAppointment = await Appointment.findOne({ caseId: newCaseId });
      if (!existingAppointment) {
        unique = true; // UUID is unique, exit the loop
      }
    }
    // Assign the unique caseId
    this.caseId = newCaseId;
  }

  next(); // Proceed to save the document
});

const Appointment = mongoose.model('Appointment', appointmentSchema);
export default Appointment;
