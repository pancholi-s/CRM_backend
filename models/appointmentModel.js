import mongoose from "mongoose";
import { v4 as uuidv4 } from "uuid";

const appointmentSchema = new mongoose.Schema({
  caseId: {
    type: String,
    unique: true,
    default: () => `CASE-${Array.from({ length: 6 }, () => 
      "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]
    ).join("")}`,
    
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
  },
  type: {
    type: String,
    // enum: ["Follow up", "Consultation", "Vaccination", "Other"],
    required: true,
  },
  typeVisit: {
    type: String,
    enum: ["Walk in", "Referral", "Online"],
    default: "Walk in",
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    required: true,
  },
  tokenDate: {
    type: Date,
    required: true,
  },
  tokenNumber: {
    type: Number,
    default: null, // Will be assigned later when the patient arrives
  },
  status: {
    type: String,
    enum: ["Scheduled", "Ongoing", "Waiting", "completed"],
    default: "Scheduled",
  },
  rescheduledFrom: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    default: null,
  },
  rescheduledTo: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Appointment",
    default: null,
  },  
  note: {
    type: String,
  },
  procedureCategory: {
    type: String, 
    required: false,
  },
});

// Middleware to generate caseId before saving a new appointment
appointmentSchema.pre("save", async function (next) {
  const Appointment = mongoose.model("Appointment");

  // Ensure caseId is generated only for NEW appointments
  if (!this.caseId) {
    let unique = false;
    let newCaseId;

    while (!unique) {
      newCaseId = `CASE-${uuidv4()}`;

      // Check if the generated caseId already exists
      const existingAppointment = await Appointment.findOne({
        caseId: newCaseId,
      });
      if (!existingAppointment) {
        unique = true;
      }
    }
    this.caseId = newCaseId;
  }

  next();
});

export default mongoose.model("Appointment", appointmentSchema);
