import mongoose from "mongoose";

const prescriptionSchema = new mongoose.Schema({
  doctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Doctor",
    required: true,
  },
  patient: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Patient",
    required: true,
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
  },
  aiGeneratedText: {
    problemStatement: String,
    icdCode: String,
    therapyPlan: String,
    medications: [String],
    injectionsTherapies: [String],
    nonDrugRecommendations: [String],
    precautions: String,
    lifestyle: [String],
    followUp: String,
    followUpInstructions: {
      reviewDate: String,
      notes: String,
    },
  },
  inputData: { type: Object, required: true },
  approved: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date },
});

export default mongoose.model("Prescription", prescriptionSchema);
