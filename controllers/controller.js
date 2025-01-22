import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";

import Receptionist from "../models/receptionistModel.js";
import Doctor from "../models/doctorModel.js";
import Patient from "../models/patientModel.js";
import Hospital from "../models/hospitalModel.js";
import Department from "../models/departmentModel.js";
import HospitalAdmin from "../models/hospitalAdminModel.js";

const models = {
  receptionist: Receptionist,
  doctor: Doctor,
  patient: Patient,
  Hospital:Hospital, 
  Department:Department,
  HospitalAdmin:HospitalAdmin
};

export const registerUser = async (req, res) => {
  const { name, email, password, phone, role, hospitalName, ...additionalData } = req.body;

  // Check for missing fields
  if (!name || !email || !password || !phone || !role || !hospitalName) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Validate the role
  if (!["receptionist", "doctor", "patient", "HospitalAdmin"].includes(role)) {
    return res.status(400).json({ message: "Invalid role specified." });
  }

  try {
    let Model = models[role];

    // Check if email is unique for role
    const existingUser = await Model.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    // Find the hospital by its name
    const hospital = await Hospital.findOne({ name: hospitalName });
    if (!hospital) {
      return res.status(400).json({ message: "Hospital not found." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    let newUser;

    if (role === "doctor") {
      const { department } = additionalData;

      // Find the department by its name
      const departmentDoc = await Department.findOne({ name: department });
      if (!departmentDoc) {
        return res.status(400).json({ message: "Department not found." });
      }

      // Create a new doctor
      newUser = new Doctor({
        name,
        email,
        password: hashedPassword,
        phone,
        role,
        hospital: hospital._id,
        departments: [departmentDoc._id],
        ...additionalData,
      });

      // Save the doctor
      await newUser.save();

      // Update the department document to include the new doctor
      await Department.findByIdAndUpdate(
        departmentDoc._id,
        { $push: { doctors: newUser._id } },
        { new: true }
      );
    } else if (role === "patient") {
      const patientStatus = additionalData.status || ["active"];
      newUser = new Patient({
        name,
        email,
        password: hashedPassword,
        phone,
        role,
        status: patientStatus,
        hospital: hospital._id,
        registrationDate: new Date(),
        ...additionalData,
      });
    } else if (role === "receptionist") {
      newUser = new Receptionist({
        name,
        email,
        password: hashedPassword,
        phone,
        role,
        hospital: hospital._id,
        ...additionalData,
      });
    } else if (role === "HospitalAdmin") {
      newUser = new HospitalAdmin({
        name,
        email,
        password: hashedPassword,
        phone,
        hospital: hospital._id,
        ...additionalData,
      });

      // Save the new admin and update the hospital document
      await newUser.save();
      await Hospital.findByIdAndUpdate(hospital._id, {
        $push: { admins: newUser._id },
      });

      return res.status(201).json({
        message: "Hospital Admin registered successfully.",
      });
    }

    // Save the user
    await newUser.save();

    // Update the hospital document with the new user
    const updateField =
      role === "doctor"
        ? "doctors"
        : role === "receptionist"
        ? "receptionists"
        : "patients";

    // Push the new user's _id into the appropriate array in the hospital document
    await Hospital.findByIdAndUpdate(
      hospital._id,
      { $push: { [updateField]: newUser._id } },
      { new: true }
    );

    res.status(201).json({
      message: `${role.charAt(0).toUpperCase() + role.slice(1)} registered successfully.`,
    });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Error registering user." });
  }
};

// login
export const loginUser = async (req, res) => {
  const { email, password, role } = req.body;

  if (!email || !password || !role) {
    return res
      .status(400)
      .json({ message: "Email, password, and role are required." });
  }

  if (!["receptionist", "doctor", "patient","HospitalAdmin"].includes(role)) {
    return res.status(400).json({ message: "Invalid role specified." });
  }

  try {
    const Model = models[role];

    // Find user by email and role
    const user = await Model.findOne({ email }).populate("hospital"); // Populate hospital details

    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    const isMatch = await bcrypt.compare(password, user.password);

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Generate JWT token
    const token = jwt.sign(
      {
        userId: user._id,
        role,
        hospitalId: user.hospital._id, // Add hospitalId to the token payload
      },
      process.env.JWT_SECRET, // Use the secret key
      { expiresIn: process.env.JWT_EXPIRES_IN || "1d" } // Token expiry
    );

    // Send token in response
    res.status(200).json({
      message: "Login successful",
      token, // Include the Bearer token in the response
      userId: user._id,
      role,
      hospitalId: user.hospital._id,
    });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Error logging in." });
  }
};
