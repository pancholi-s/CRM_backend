import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
    }, // Add case_id field
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
    services: [
      {
        service: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
        quantity: { type: Number, default: 1 },
      },
    ],
    totalAmount: { type: Number, required: true },
    paidAmount: { type: Number, required: true, default: 0 },
    outstanding: { type: Number, required: true },
    status: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
    invoiceNumber: { type: String, unique: true },
    invoiceDate: { type: Date, default: Date.now },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Receptionist",
      required: true,
    },
    mode: { type: String, enum: ["Online", "Cash"], required: true },
  },
  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);
