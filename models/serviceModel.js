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
        // Room pricing details are optional, only used for room-type services
        additionaldetails: { 
          type: mongoose.Schema.Types.Mixed,  // Store dynamic details for room types
          default: null // Optional field for room service breakdown
        },
      },
    ],
    lastUpdated: { type: Date, default: Date.now },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      // required: true,
    },
    revenueType: {
      type: String,
      enum: ['Outpatient', 'Inpatient', 'Surgery', 'Diagnostics'],
    },
  },
  { timestamps: true }
);

export default mongoose.model("Service", serviceSchema);
