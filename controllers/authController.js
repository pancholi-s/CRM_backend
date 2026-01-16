import bcrypt from "bcryptjs";
import crypto from "crypto";
import jwt from "jsonwebtoken";

import Receptionist from "../models/receptionistModel.js";
import Doctor from "../models/doctorModel.js";
import Patient from "../models/patientModel.js";
import Hospital from "../models/hospitalModel.js";
import Department from "../models/departmentModel.js";
import HospitalAdmin from "../models/hospitalAdminModel.js";
import Staff from "../models/staffModel.js";

import { sendPasswordResetEmail } from "../utils/emailService.js";

const models = {
  receptionist: Receptionist,
  doctor: Doctor,
  patient: Patient,
  hospital: Hospital,
  department: Department,
  hospitalAdmin: HospitalAdmin,
  staff: Staff,
};

export const registerUser = async (req, res) => {
  const {
    name,
    email,
    password,
    phone,
    role,
    hospitalName,
    ...additionalData
  } = req.body;

  if (!name || !email || !password || !phone || !role || !hospitalName) {
    return res.status(400).json({ message: "All fields are required." });
  }

  const allowedRoles = ["receptionist", "doctor", "patient", "hospitalAdmin"];
  if (!allowedRoles.includes(role)) {
    return res.status(400).json({ message: "Invalid role specified." });
  }

  try {
    const Model = models[role];

    // ✅ Email uniqueness per role
    const existingUser = await Model.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    // ✅ Hospital validation
    const hospital = await Hospital.findOne({ name: hospitalName });
    if (!hospital) {
      return res.status(400).json({ message: "Hospital not found." });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    let newUser;

    /* ===================== DOCTOR ===================== */
    if (role === "doctor") {
      const { department } = additionalData;
      if (!department) {
        return res.status(400).json({ message: "Department is required for doctor." });
      }

      const departmentDoc = await Department.findOne({
        name: department,
        hospital: hospital._id,
      });

      if (!departmentDoc) {
        return res.status(400).json({ message: "Department not found in this hospital." });
      }

      newUser = await Doctor.create({
        name,
        email,
        password: hashedPassword,
        phone,
        role,
        hospital: hospital._id,
        departments: [departmentDoc._id],
        ...additionalData,
      });

      // ✅ Link doctor → department (no duplicates)
      await Department.findByIdAndUpdate(
        departmentDoc._id,
        { $addToSet: { doctors: newUser._id } }
      );
    }

    /* ===================== PATIENT ===================== */
    else if (role === "patient") {
      newUser = await Patient.create({
        name,
        email,
        password: hashedPassword,
        phone,
        role,
        status: additionalData.status || "active",
        hospital: hospital._id,
        registrationDate: new Date(),
        ...additionalData,
      });
    }

    /* ===================== RECEPTIONIST ===================== */
    else if (role === "receptionist") {
      newUser = await Receptionist.create({
        name,
        email,
        password: hashedPassword,
        phone,
        role,
        hospital: hospital._id,
        ...additionalData,
      });
    }

    /* ===================== HOSPITAL ADMIN ===================== */
    else if (role === "hospitalAdmin") {
      newUser = await HospitalAdmin.create({
        name,
        email,
        password: hashedPassword,
        phone,
        role,
        hospital: hospital._id,
        ...additionalData,
      });

      await Hospital.findByIdAndUpdate(
        hospital._id,
        { $addToSet: { admins: newUser._id } }
      );
    }

    /* ===================== HOSPITAL LINK ===================== */
    const hospitalFieldMap = {
      doctor: "doctors",
      receptionist: "receptionists",
      patient: "patients",
    };

    const hospitalField = hospitalFieldMap[role];
    if (hospitalField) {
      await Hospital.findByIdAndUpdate(
        hospital._id,
        { $addToSet: { [hospitalField]: newUser._id } }
      );
    }

    return res.status(201).json({
      message: `${role} registered successfully.`,
      newUser,
    });

  } catch (error) {
    console.error("❌ Error registering user:", error);
    return res.status(500).json({ message: "Error registering user." });
  }
};

export const loginUser = async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    let user = null;
    let role = null;

for (const [key, Model] of Object.entries(models)) {
  if (key === "doctor") {
    user = await Model.findOne({ email })
      .select("+password")          // ✅ FIX
      .populate("hospital")
      .populate("departments");
  } else if (key === "staff") {
    user = await Model.findOne({ email })
      .select("+password")          // ✅ FIX
      .populate("hospital")
      .populate("department");
  } else {
    user = await Model.findOne({ email })
      .select("+password")          // ✅ FIX
      .populate("hospital");
  }

  if (user) {
    role = key;
    break;
  }
}


    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const token = jwt.sign(
      {
        userId: user._id,
        role,
        hospitalId: user.hospital._id,
        hospitalName: user.hospital.name,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" }
    );

      res.status(200).json({
        message: "Login successful",
        token,
        userId: user._id,
        role,
        username: user.name,
        hospitalId: user.hospital._id,
        hospitalName: user.hospital.name,
        hospitalImage: user.hospital.hospitalImage || null, 
        departmentIds: role === "doctor" && user.departments
          ? user.departments.map((dep) => dep._id)
          : undefined,
        departmentNames: role === "doctor" && user.departments
          ? user.departments.map((dep) => dep.name)
          : undefined,
      });

  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Error logging in." });
  }
};

export const forgotPassword = async (req, res) => {
  const { email } = req.body;

  if (!email) { 
    return res.status(400).json({ message: "Email is required." });
  }

  try {
    let user = null;
    let role = null;

    for (const [key, Model] of Object.entries(models)) {
      user = await Model.findOne({ email });
      if (user) {
        role = key;
        break;
      }
    }

    if (!user) {
      return res.status(404).json({ message: "No account found with this email." });
    }
    
    const resetToken = crypto.randomBytes(32).toString("hex");
    const hashedToken = await bcrypt.hash(resetToken, 10);

    user.passwordResetToken = hashedToken;
    user.passwordResetExpires = Date.now() + 15 * 60 * 1000; // 15 mins expiry
    await user.save();

    const resetLink = `${process.env.FRONTEND_BASE_URL}/reset-password?token=${resetToken}&role=${role}`;

    await sendPasswordResetEmail(user.email, user.name, resetLink);

    res.status(200).json({ message: "Password reset link sent to your email." });

  } catch (error) {
    console.error("Error in forgotPassword:", error);
    res.status(500).json({ message: "Error processing password reset request." });
  }
};

export const resetPassword = async (req, res) => {
  const token = req.headers.authorization?.split(" ")[1];
  const { newPassword, role } = req.body;

  if (!token || !newPassword || !role) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const Model = models[role];
    if (!Model) {
      return res.status(400).json({ message: "Invalid role." });
    }

    const user = await Model.findOne({ passwordResetToken: { $ne: null } });
    if (!user) {
      return res.status(400).json({ message: "Invalid or expired token." });
    }

    if (user.passwordResetExpires < Date.now()) {
      return res.status(400).json({ message: "Reset link has expired." });
    }

    const isMatch = await bcrypt.compare(token, user.passwordResetToken);
    if (!isMatch) {
      return res.status(400).json({ message: "Invalid token." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    user.password = hashedPassword;
    user.passwordResetToken = null;
    user.passwordResetExpires = null;
    await user.save();

    res.status(200).json({ message: "Password reset successfully. You can now login." });
    
  } catch (error) {
    console.error("Error in resetPassword:", error);
    res.status(500).json({ message: "Error resetting password." });
  }
};
