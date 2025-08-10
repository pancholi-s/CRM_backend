import mongoose from "mongoose";

const requestSchema = new mongoose.Schema(
  {
    requestBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    order: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      required: false,
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
      enum: ["Pending", "Active", "Completed"],
      default: "Pending",
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
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
    acceptedDate: {
      type: Date,
    },
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

// Virtual for checking request state
requestSchema.virtual("isPending").get(function () {
  return this.status === "Pending";
});

requestSchema.virtual("isActive").get(function () {
  return this.status === "Active";
});

requestSchema.virtual("isCompleted").get(function () {
  return this.status === "Completed";
});

// Method to add a message
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

// Method to accept request
requestSchema.methods.acceptRequest = async function (
  message,
  messageBy,
  messageByRole,
  messageByModel,
  messageByName
) {
  this.status = "Active";
  this.acceptedDate = new Date();

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

// Method to complete request
requestSchema.methods.completeRequest = async function (
  message,
  messageBy,
  messageByRole,
  messageByModel,
  messageByName
) {
  this.status = "Completed";
  this.completedDate = new Date();

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
