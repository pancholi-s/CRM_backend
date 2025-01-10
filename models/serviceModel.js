import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, // Main category name
    description: { type: String },
    categories: [
      {
        category: { type: String, required: true }, // Sub-category name
        rateType: { type: String, required: true },
        rate: { type: Number, required: true }, // Rate for the sub-category
        effectiveDate: { type: Date, required: true }, // Effective date for the rate
        amenities: { type: String, default: "N/A" }, // Additional amenities
      }
    ],
    lastUpdated: { type: Date, default: Date.now }, // Last updated date
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    revenueType: {
      type: String,
      enum: ['Outpatient', 'Inpatient', 'Surgery', 'Diagnostics'], // Main categories for revenue grouping
      // required: true,
    },
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);
