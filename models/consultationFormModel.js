import mongoose from "mongoose";

const fieldSchema = new mongoose.Schema({
  id: String,
  type: String,
  question: String,
  placeholder: String,
  isReadOnly: Boolean,
  options: [String], // for dropdown, checklist, radio
}, { _id: false });

const sectionSchema = new mongoose.Schema({
  id: String,
  name: String,
  isStatic: Boolean,
  fields: [fieldSchema],
}, { _id: false });

const consultationFormSchema = new mongoose.Schema({
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
  title: { type: String, required: true },
  sections: [sectionSchema],
}, { timestamps: true });

export default mongoose.model("ConsultationForm", consultationFormSchema);
