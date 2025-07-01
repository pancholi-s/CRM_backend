import mongoose from "mongoose";

const criticalPatientSchema = new mongoose.Schema({
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
  severity: {
    type: String,
    enum: ["Critical", "High", "Moderate"],
    required: true,
  },
  condition: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["Active", "Resolved"],
    default: "Active",
  }
}, {
  timestamps: true,
});

criticalPatientSchema.index({ hospital: 1, status: 1, severity: 1 });
criticalPatientSchema.index({ patient: 1, status: 1 });

export default mongoose.model("CriticalPatient", criticalPatientSchema);
