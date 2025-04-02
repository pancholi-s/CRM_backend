import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true }, 
    description: { type: String },
    categories: [
      {
        subCategoryName: { type: String, required: true }, 
        rateType: { type: String, required: true },
        rate: { type: Number, required: true }, 
        effectiveDate: { type: Date, required: true }, 
        amenities: { type: String, default: "N/A" },
        hospital: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Hospital",
          required: true,
        }, 
      }
    ],
    lastUpdated: { 
      type: Date,
      default: Date.now
    }, 
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Department',
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
