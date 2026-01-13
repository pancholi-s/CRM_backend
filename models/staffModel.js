import mongoose from "mongoose";
import bcrypt from "bcryptjs";

const staffSchema = new mongoose.Schema({
  profile: {
    type: String,
  },

  staff_id: {
    type: String,
    required: true,
    unique: true,
  },

  name: {
    type: String,
    required: true,
  },

  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },

  password: {
    type: String,
    required: true,
    minlength: 8,
    select: false, // 🔐 never return password by default
  },

  phone: {
    type: String,
    required: true,
  },

  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Department",
    required: true,
  },

  designation: {
    type: String,
    required: true,
  },

  status: {
    type: String,
    enum: ["Available", "On Leave"],
    default: "Available",
  },

  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true,
  },

  role: {
    type: String,
    enum: ["staff"],
    default: "staff",
  },
}, { timestamps: true });


// 🔐 Hash password before save
staffSchema.pre("save", async function (next) {
  if (!this.isModified("password")) return next();
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

// 🔑 Password comparison helper
staffSchema.methods.comparePassword = function (password) {
  return bcrypt.compare(password, this.password);
};

export default mongoose.model("Staff", staffSchema);
