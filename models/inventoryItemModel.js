import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "InventoryCategory",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    quantity: {
      type: Number,
      required: true,
      min: 0,
    },
    lastRestockedDate: {
      type: Date,
    },
    usagePercent: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["Low stock", "Sufficient", "Critical", "Moderate"],
      default: "Sufficient",
    },
    lastUpdated: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

export default mongoose.model("InventoryItem", inventoryItemSchema);
