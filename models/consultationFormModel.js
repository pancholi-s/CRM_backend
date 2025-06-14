import mongoose from "mongoose";

const customFieldSchema = new mongoose.Schema({
  label: { type: String, required: true },
  type: {
    type: String,
    enum: ["text", "textarea", "dropdown", "checklist"],
    required: true,
  },
  options: [{ type: String }],
});

const consultationFormSchema = new mongoose.Schema(
  {
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
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
    title: { type: String, required: true },
    predefinedFields: {
      type: Map,
      of: mongoose.Schema.Types.Mixed,
      default: {
        symptoms: [],
        diagnosis: "",
      },
    },

    customFields: [customFieldSchema],
  },
  { timestamps: true }
);

export default mongoose.model("ConsultationForm", consultationFormSchema);
