import mongoose from "mongoose";

const requestSchema = new mongoose.Schema(
  {
    requestBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    quantity: {
      type: String,
      required: true,
    },
    timeline: {
      type: String,
      required: true,
    },
    purpose: {
      type: String,
      required: true,
    },
    status: {
      type: String,
      enum: ["Active", "Inactive"],
      default: "Active",
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    // Simple timeline for comments/updates
    messages: [
      {
        message: {
          type: String,
          required: true,
        },
        messageBy: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        messageByRole: {
          type: String,
          enum: ["doctor", "hospitalAdmin", "receptionist", "staff"],
          required: true,
        },

        messageByModel: {
          type: String,
          enum: ["Doctor", "HospitalAdmin"],
          required: true,
        },
        messageByName: {
          type: String,
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    completedDate: {
      type: Date,
    },
  },
  {
    timestamps: true,
  }
);

// Indexes for better performance
requestSchema.index({ requestBy: 1, status: 1 });
requestSchema.index({ hospital: 1, status: 1 });
requestSchema.index({ createdAt: -1 });

// Virtual for checking if request is active
requestSchema.virtual("isActive").get(function () {
  return this.status === "Active";
});

// Method to add a message to timeline
requestSchema.methods.addMessage = function (
  message,
  messageBy,
  messageByRole,
  messageByModel,
  messageByName
) {
  this.messages.push({
    message,
    messageBy,
    messageByRole,
    messageByModel,
    messageByName,
    timestamp: new Date(),
  });
  return this.save();
};

// Method to update status
requestSchema.methods.updateStatus = async function (
  newStatus,
  message,
  messageBy,
  messageByRole,
  messageByModel,
  messageByName
) {
  this.status = newStatus;
  if (newStatus === "Inactive") {
    this.completedDate = new Date();
  }

  if (message) {
    await this.addMessage(
      message,
      messageBy,
      messageByRole,
      messageByModel,
      messageByName
    );
  }
  return this.save();
};

export default mongoose.model("Request", requestSchema);
