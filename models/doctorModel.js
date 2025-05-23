import mongoose from "mongoose";

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  specialization: {
    type: String,
    // required: true,
  },
  head: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    default: null,
  },
  phone: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ["Emergency Room", "On Leave", "Idle", "In Meeting", "With Patient"],
    default: "Idle",
  },
  patients: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },
  ],
  appointments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
  ],
  departments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
      required: true,
    },
  ],
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
  },
  availability: {
    type: [String], // e.g., ['Monday 9:00 AM - 5:00 PM', 'Tuesday 9:00 AM - 5:00 PM']
    required: false, // change during doctor view
  },
  role: {
    type: String,
    default: "doctor",
    required: true,
  },
  assignedRooms: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Room",
    },
  ],
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
      type: Date,
      default: null
  },
});

export default mongoose.model("Doctor", doctorSchema);
