import mongoose from "mongoose";

const medicalRecordSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  medication: { type: String, required: true },
  dose: { type: String, required: true },
  route: { type: String, required: true },
  time: { type: String, required: true },
  givenBy: { type: String },
  notes: { type: String },
  status: {
    type: String,
    enum: ["Scheduled", "Rescheduled", "Given"],
    default: "Scheduled"
  }
}, { timestamps: true });

export default mongoose.model("MedicalRecord", medicalRecordSchema);
