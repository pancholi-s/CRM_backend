import mongoose from "mongoose";

const hospitalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  address: {
    street: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    zipCode: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  website: {
    type: String,
    required: false,
  },
  establishedDate: {
    type: Date,
  },
  administrativeDetails: {
    name: { type: String, required: true },
    contact: { type: String, required: true },
    email: { type: String, required: true },
  },
  licenses: [
    {
      name: { type: String, required: true },
      file: { type: String, required: true },
    },
  ],
  nabhAccreditation: {
    type: Boolean,
    default: false,
  },
  description: {
    type: String,
  },
  departments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Department",
    },
  ],
  appointments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
  ],
  RejectedAppointment: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "RejectedAppointment",
    },
  ],
  doctors: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
  ],
  receptionists: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Receptionist",
    },
  ],
  patients: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
    },
  ],
  mainAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "MainAdmin",
  },
  hospitalAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "HospitalAdmin",
  },
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
  expenses: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Expense",
      default: [],
    },
  ],
  revenue: {
    type: Number,
    default: 0,
  },
  hospitalImage: { type: String, default: null },
  hospitalImagePublicId: { type: String, default: null },
});

export default mongoose.model("Hospital", hospitalSchema);
