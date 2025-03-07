import mongoose from "mongoose";

const hospitalAdminSchema = new mongoose.Schema({
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
  role: {
    type: String,
    default: "hospitalAdmin",
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
  },
  canManage: {
    // check later
    type: Object,
    default: {
      doctors: true,
      patients: true,
      appointments: true,
      receptionists: true,
    },
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
      type: Date,
      default: null
  },
});

export default mongoose.model("HospitalAdmin", hospitalAdminSchema);
