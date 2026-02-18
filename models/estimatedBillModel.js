import mongoose from "mongoose";

const estimatedBillSchema = new mongoose.Schema(
  {
    admissionRequest: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "AdmissionRequest",
      required: true
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true
    },
    grandTotal: {
      type: Number,
      required: true
    },
    categories: [
      {
        categoryName: { type: String, required: true },
        subtotal: { type: Number, required: true },
        items: [
          {
            category: { type: String, required: true },
            name: { type: String },
            type: { type: String },
            rate: { type: Number, required: true },
            quantity: { type: Number, required: true },
            total: { type: Number, required: true },
            date: { type: Date, required: true }
          }
        ]

      }
    ],
    isFinalized: { type: Boolean, default: false } // later if converted to real bill
  },
  { timestamps: true }
);

export default mongoose.model("EstimatedBill", estimatedBillSchema);
