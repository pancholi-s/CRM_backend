import mongoose from "mongoose";

const fileSchema = new mongoose.Schema(
  {
    filename: {
      type: String,
      required: true,
    },
    originalName: {
      type: String,
      required: true,
    },
    url: {
      type: String,
      required: true,
    },
    publicId: {
      type: String,
      required: true,
    },
    fileType: {
      type: String,
      required: true,
    },
    fileSize: {
      type: Number,
      required: true,
    },
    resourceType: {
      type: String,
      enum: ["image", "video", "raw"],
      required: true,
    },
    folder: {
      type: String,
      default: "uploads",
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    uploadedBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      role: {
        type: String,
        required: true,
        enum: ["mainAdmin", "hospitalAdmin", "doctor", "receptionist"],
      },
    },
  },
  {
    timestamps: true,
  }
);

fileSchema.index({ hospital: 1, patient: 1 });
fileSchema.index({ patient: 1, uploadedAt: -1 });

const PatientFile = mongoose.model("PatientFile", fileSchema);

export default PatientFile;
