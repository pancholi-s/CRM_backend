import mongoose from "mongoose";

const integrationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  apiKey: {
    type: String,
    required: true,
    unique: true,
  },

  accessType: {
    type: String,
    enum: ["all", "restricted"],
    default: "all",
  },

  hospitals: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
    },
  ],

  status: {
    type: String,
    enum: ["active", "disabled"],
    default: "active",
  },
}, { timestamps: true });

export default mongoose.model("Integration", integrationSchema);