import mongoose from "mongoose";

const patientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  gender: {
    type: String,
    //required: true,
  },
  birthday: {
    type: String,
    //required: true,
  },
  //automatically calculate age according to the date of birth
  age: {
    type: Number,
    //required: true,
  },
  address: {
    type: String,
    //required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    minlength: 8,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  medicalHistory: [
    {
      type: [String],
    },
  ],
  currentMedication: [
    {
      type: String,
    },
  ],
  symptoms: [
    {
      type: String,
    },
  ],
  socialHistory: [
    {
      type: String,
    },
  ],
  healingProgress: [
    {
      type: String,
    },
  ],
  goals: [
    {
      type: String,
    },
  ],
  nextStep: [
    {
      type: String,
    },
  ],
  registrationDate: {
    type: Date,
    default: Date.now,
  },
  profilePhoto: {
    type: String,
    required: false,
  },
  appointments: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Appointment",
    },
  ],
  doctors: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
    },
  ],
  role: {
    type: String,
    default: "patient",
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
  },
  //check for patients in multiple hospitals
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
  },
  status: {
    type: String,
    enum: ["active", "inactive"],
    default: "active",
  },
  files: [
    {
      fileName: { type: String, required: true },
      fileType: { type: String, required: true },
      fileUrl: { type: String, required: true },
      uploadedAt: { type: Date, default: Date.now },
      description: { type: String, required: false },
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
  bills: [{ type: mongoose.Schema.Types.ObjectId, ref: "Bill" }],
});

export default mongoose.model("Patient", patientSchema);
