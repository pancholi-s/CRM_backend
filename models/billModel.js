import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
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
    status: { type: String, enum: ["Pending", "Paid"], default: "Pending" },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Receptionist",
      required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);
