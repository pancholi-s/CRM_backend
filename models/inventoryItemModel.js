import mongoose from "mongoose";

const inventoryItemSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    quantity: {
      type: Number,
      required: true,
    },
    minimumStockThreshold: {
      type: Number,
      required: true,
      default: 10,
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
    lastRestockedDate: Date,
    lastUpdated: Date,
    status: {
      type: String,
      enum: ["Low Stock", "Moderate", "Sufficient"],
      default: "Sufficient",
    },
    usagePercent: Number,
  },
  { timestamps: true }
);

export default mongoose.model("InventoryItem", inventoryItemSchema);
