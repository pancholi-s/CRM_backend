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
          type: mongoose.Schema.Types.Mixed, // To store additional details about the service 
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
    deposit: { type: Number, default: 0 },
    payments: [
      {
        amount: Number,       // +ve = payment, -ve = refund
        date: { type: Date, default: Date.now },
        mode: {
          type: String,
          enum: ["UPI", "Cash", "Card", "Net Banking","Original", "Insurance"],
          default: "Cash",
        },
        reference: String,

        tds: { type: Number, default: 0 },     // 1,00,000
        total: { type: Number },   
        
        type: {
          type: String,
          enum: ["Payment", "Refund"],
          default: "Payment",
        },
      },
    ],
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
    isLive: { type: Boolean, default: false },
    lastBilledAt: { type: Date, default: null },

    discount: {
      type: {
        type: String,
        enum: ["Flat", "Percentage"],
      },
      value: { type: Number, default: 0 },
      amount: { type: Number, default: 0 }, // computed discount amount
      reason: { type: String },
      appliedAt: { type: Date }
    },

    grossAmount: {
      type: Number,
      default: 0
    },

    netAmount: {
      type: Number,
      default: 0
    }


  },

  { timestamps: true }
);

export default mongoose.model("Bill", billSchema);
