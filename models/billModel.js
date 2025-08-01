import mongoose from "mongoose";

const billSchema = new mongoose.Schema(
  {
    caseId: {
      type: String,
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: false, //change to true -> when doctor view is being developed to link doctor to bill
    },
    services: [
      {
        service: { type: mongoose.Schema.Types.ObjectId, ref: "Service" },
        category: { type: String, required: true },
        quantity: { type: Number, default: 1 },
        rate: { type: Number }, // Admin will update this rate
        details: { 
          type:mongoose.Schema.Types.Mixed, // To store additional details about the service 
        }, 
      },
    ],
    totalAmount: {
      type: Number,
      required: true,
    },
    paidAmount: {
      type: Number,
      required: true,
      default: 0,
    },
    outstanding: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["Pending", "Paid"],
      default: "Pending",
    },
    invoiceNumber: {
      type: String,
      unique: true,
    },
    invoiceDate: {
      type: Date,
      default: Date.now,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    mode: {
      type: String,
      enum: ["Online", "Cash"],
      required: true,
    },
  },

  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);
