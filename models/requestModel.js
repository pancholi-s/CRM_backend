import mongoose from "mongoose";

const requestSchema = new mongoose.Schema(
  {
    requestBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    requestType: {
      type: String,
      enum: ["Medicine", "Equipment", "Supply", "Maintenance", "Other"],
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
    priority: {
      type: String,
      enum: ["Low", "Medium", "High", "Critical"],
      default: "Medium",
    },
    status: {
      type: String,
      enum: ["Active", "In Active", "Completed", "Rejected", "Cancelled"],
      default: "Active",
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
    items: [
      {
        name: {
          type: String,
          required: true,
        },
        quantity: {
          type: Number,
          required: true,
        },
        unit: {
          type: String,
          default: "pcs",
        },
        specifications: {
          type: String,
        },
      },
    ],
    timeline: [
      {
        action: {
          type: String,
          required: true,
        },
        message: {
          type: String,
          required: true,
        },
        actionBy: {
          type: mongoose.Schema.Types.ObjectId,
          required: true,
        },
        actionByRole: {
          type: String,
          enum: ["doctor", "hospitalAdmin", "receptionist", "staff"],
          required: true,
        },
        actionByModel: {
          type: String,
          enum: ["Doctor", "HospitalAdmin", "Receptionist", "Staff"],
          required: true,
        },
        timestamp: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    attachments: [
      {
        filename: String,
        url: String,
        uploadedBy: {
          type: mongoose.Schema.Types.ObjectId,
        },
        uploadedByModel: {
          type: String,
          enum: ["Doctor", "HospitalAdmin", "Receptionist", "Staff"],
        },
        uploadedAt: {
          type: Date,
          default: Date.now,
        },
      },
    ],
    expectedDate: {
      type: Date,
    },
    completedDate: {
      type: Date,
    },
    notes: {
      type: String,
    },
    estimatedCost: {
      type: Number,
    },
    actualCost: {
      type: Number,
    },
  },
  {
    timestamps: true,
  }
);

requestSchema.index({ requestBy: 1, status: 1 });
requestSchema.index({ hospital: 1, status: 1 });
requestSchema.index({ department: 1, status: 1 });
requestSchema.index({ createdAt: -1 });

requestSchema.virtual("isActive").get(function () {
  return ["Active", "In Progress"].includes(this.status);
});

requestSchema.methods.addTimelineEntry = function (
  action,
  message,
  actionBy,
  actionByRole,
  actionByModel
) {
  this.timeline.push({
    action,
    message,
    actionBy,
    actionByRole,
    actionByModel,
    timestamp: new Date(),
  });
  return this.save();
};

requestSchema.methods.updateStatus = async function (
  newStatus,
  message,
  actionBy,
  actionByRole,
  actionByModel
) {
  this.status = newStatus;
  if (newStatus === "Completed") {
    this.completedDate = new Date();
  }

  await this.addTimelineEntry(
    `Status changed to ${newStatus}`,
    message,
    actionBy,
    actionByRole,
    actionByModel
  );
  return this;
};

export default mongoose.model("Request", requestSchema);
