import mongoose from "mongoose";

const chatMessageSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ["doctor", "ai"], required: true },
    message: { type: String, required: true },
  },
  { timestamps: true }
);

const prescriptionChatSchema = new mongoose.Schema(
  {
    prescription: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "NewPrescription",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    messages: [chatMessageSchema],
  },
  { timestamps: true }
);

export default mongoose.model("PrescriptionChat", prescriptionChatSchema);
