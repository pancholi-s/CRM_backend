// models/ProgressLog.js

import mongoose from "mongoose";

const progressEntrySchema = new mongoose.Schema({
  caseId: { type: String, required: true },
  sourceType: { type: String, enum: ["consultation", "phase"], required: true },
  sourceId: { type: mongoose.Schema.Types.ObjectId, required: true },
  phaseCategory: { type: String, enum: ["initial", "middle", "ongoing", "final"], required: true },
  status: { type: String, enum: ["ongoing", "completed", "final"], default: "ongoing" },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: "Doctor" },
  department: { type: mongoose.Schema.Types.ObjectId, ref: "Department" },
  date: { type: Date, default: Date.now },
}, { _id: false });

const progressLogSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: "Patient", required: true, unique: true },
  date: { type: Date, default: Date.now },
  status: { type: String, enum: ["ongoing", "completed", "final"], default: "ongoing" },
  logs: [progressEntrySchema],
}, { timestamps: true });

export default mongoose.model("ProgressLog", progressLogSchema);
