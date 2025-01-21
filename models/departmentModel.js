import mongoose from "mongoose";

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  head: {
    type: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Doctor",
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
    },
  },
  patients: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },
  ],
  doctors: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
  ],
  specialistDoctors: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
  ],
  rooms: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
      default: [],
    },
  ],
  staffs: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      default: [],
    },
  ],
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
  },
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
  }],
  nurses: [
    {
      type: String,
    },
  ],
  specializedProcedures: [
    {
      type: String,
    },
  ],
  facilities: [
    {
      type: String,
    },
  ],
  criticalEquipments: [
    {
      type: String,
    },
  ],
  equipmentMaintenance: [
    {
      type: String,
    },
  ],
});

export default mongoose.model("Department", departmentSchema);
