import mongoose from "mongoose";

const bedSchema = new mongoose.Schema(
  {
    bedNumber: {
      type: String,
      required: true,
    },
    bedType: {
      type: String,
      enum: [
        "ICU",
        "General",
        "Private",
        "Semi-Private",
        "Emergency",
        "Pediatric",
        "Maternity",
      ],
      // required: true,
    },
    room: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    department: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
    assignedPatient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      default: null,
    },
    status: {
      type: String,
      enum: ["Available", "Occupied", "Under Maintenance", "Reserved"],
      default: "Available",
      required: true,
    },
    assignedDate: {
      type: Date,
      default: null,
    },
    dischargeDate: {
      type: Date,
      default: null,
    },
    features: {
      hasOxygen: { type: Boolean, default: false },
      hasVentilator: { type: Boolean, default: false },
      hasMonitor: { type: Boolean, default: false },
      isIsolation: { type: Boolean, default: false },
    },
    charges: {
      dailyRate: { type: Number, default: 0 },
      currency: { type: String, default: "INR" },
    },
    linkedAttendantBed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bed",
      default: null,
    },
    hasAttendant: {
      type: Boolean,
      default: false,
    },
    isAttendantBed: {
      type: Boolean,
      default: false,
    },
    linkedPatientBed: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Bed",
      default: null,
    },
    attendantDetails: {
      name: String,
      relationship: {
        type: String,
        enum: [
          "Father",
          "Mother",
          "Son",
          "Daughter",
          "Spouse",
          "Sibling",
          "Guardian",
          "Other",
        ],
      },
      contactNumber: String,
      purpose: String,
      expectedDuration: String,
      additionalNotes: String,
      approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
      },
      requestedBy: {
        type: mongoose.Schema.Types.ObjectId,
        refPath: "requestedByModel",
      },
      requestedByModel: {
        type: String,
        enum: ["hospitalAdmin", "receptionist", "doctor"],
      },
      status: {
        type: String,
        enum: ["Pending", "Approved", "Rejected"],
        default: "Pending",
      },
      requestDate: {
        type: Date,
        default: Date.now,
      },
      approvalDate: Date,
    },
  },
  {
    timestamps: true,
  }
);

bedSchema.index({ hospital: 1, department: 1, status: 1 });
bedSchema.index({ room: 1, bedNumber: 1 }, { unique: true });

export default mongoose.model("Bed", bedSchema);
