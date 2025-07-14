import mongoose from "mongoose";

const medicalRecordSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true },
  medication: { type: String, required: true },
  dose: { type: String, required: true },
  route: { type: String, required: true },
  time: { type: String, required: true },
  givenBy: { type: String, required: true },
  notes: { type: String },
  status: {
    type: String,
    enum: ["Scheduled", "Next", "Given"],
    default: "Scheduled"
  }
}, { timestamps: true });

export default mongoose.model("MedicalRecord", medicalRecordSchema);
