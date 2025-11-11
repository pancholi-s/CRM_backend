import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true },
    description: { type: String },
    categories: [
      {
        subCategoryName: { type: String, required: true },
        rateType: { type: String, required: true },
        rate: { type: Number, required: true }, // Base rate for the category
        effectiveDate: { type: Date, required: true },
        amenities: { type: String, default: "N/A" },
        hospital: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Hospital",
          required: true,
        },
        departments: [
          {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Department", // Referring multiple departments where the service is available
          },
        ],
        additionaldetails: {
          type: mongoose.Schema.Types.Mixed, // Optional details for room services
          default: null,
        },
      },
    ],
    lastUpdated: { type: Date, default: Date.now },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    departments: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Department", // Referring multiple departments where the service is available
      },
    ],
    revenueType: {
      type: String,
      enum: ["Outpatient", "Inpatient", "Surgery", "Diagnostics"],
    },
  },
  { timestamps: true }
);

// Ensure one service per hospital by name
serviceSchema.index({ hospital: 1, name: 1 }, { unique: true });

export default mongoose.model("Service", serviceSchema);
