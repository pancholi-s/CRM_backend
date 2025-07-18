import mongoose from 'mongoose';

const consultationSchema = new mongoose.Schema({
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor', required: true },
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  department: { type: mongoose.Schema.Types.ObjectId, ref: 'Department', required: true },
  appointment: { type: mongoose.Schema.Types.ObjectId, ref: 'Appointment', required: true },
  caseId: { type: String, required: true },
  consultationData: { type: mongoose.Schema.Types.Mixed, required: true },
  date: { type: Date, default: Date.now },

  status: {
    type: String,
    enum: ["completed", "referred", "scheduled"],
    default: "completed"
  },
  followUpRequired: { type: Boolean, default: false },

  // Used for "refer"
  tab: { type: String, enum: ["internal", "external"] },
  referralUrgency: { type: String },

  // Internal referral
  referredToDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  referredToDepartment: { type: mongoose.Schema.Types.ObjectId, ref: 'Department' },
  referralReason: { type: String },
  preferredDate: { type: Date },
  preferredTime: { type: String },
  referralTracking: {
    id: { type: String },
    status: { type: String },
    followUpDate: { type: Date }
  },

  // External referral
  primaryDiagnosis: { type: String },
  externalFacility: { type: String },
  newFacilityName: { type: String },
  referredSpecialist: { type: String },
  specialtyArea: { type: String },
  supportingDocument: { type: String },

  // Schedule treatment
  treatment: {
    patientName: { type: String },
    age: { type: Number },
    assignedDoctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
    admitted: { type: Boolean },
    treatmentType: { type: String },
    treatmentDate: { type: Date },
    availableSlot: { type: String },
    note: { type: String }
  }
});

export default mongoose.model('Consultation', consultationSchema);
