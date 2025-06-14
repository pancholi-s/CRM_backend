import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema(
  {
    doctors: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
      },
    ],

    staff: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Staff",
      },
    ],

    patients: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Patient",
        required: true,
      },
    ],

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

    assignmentType: {
      type: String,
      enum: ["doctor", "staff"],
      required: true,
    },

    role: {
      type: String,
      required: true,
    },

    shift: {
      type: String,
      enum: ["Morning", "Evening", "Night"],
      required: true,
    },

    duration: {
      type: String,
      enum: ["One Time Visit", "Till Discharge"],
      required: true,
    },

    status: {
      type: String,
      enum: ["Active", "Completed", "Cancelled"],
      default: "Active",
    },

    assignedBy: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "assignedByModel",
      required: true,
    },

    assignedByModel: {
      type: String,
      required: true,
      enum: ["HospitalAdmin", "Receptionist", "Doctor", "Staff"], 
    },
  },
  {
    timestamps: true,
  }
);

assignmentSchema.pre("validate", function (next) {
  const hasDoctor = this.doctors && this.doctors.length > 0;
  const hasStaff = this.staff && this.staff.length > 0;

  if (!hasDoctor && !hasStaff) {
    return next(new Error("Either doctors or staff must be assigned"));
  }

  if (hasDoctor && hasStaff) {
    return next(new Error("Cannot assign both doctors and staff in the same assignment"));
  }

  if (this.assignmentType === "doctor" && !hasDoctor) {
    return next(new Error("Assignment type is doctor but no doctors provided"));
  }

  if (this.assignmentType === "staff" && !hasStaff) {
    return next(new Error("Assignment type is staff but no staff provided"));
  }

  next();
});

assignmentSchema.index({ doctors: 1, status: 1 });
assignmentSchema.index({ staff: 1, status: 1 });
assignmentSchema.index({ patients: 1, status: 1 });
assignmentSchema.index({ hospital: 1, department: 1 });
assignmentSchema.index({ assignmentType: 1, status: 1 });
assignmentSchema.index({ createdAt: -1 });

export default mongoose.model("Assignment", assignmentSchema);