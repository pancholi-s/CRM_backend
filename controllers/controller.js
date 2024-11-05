import bcrypt from "bcryptjs";
import Receptionist from "../models/receptionistModel.js";
import Doctor from "../models/doctorModel.js";
import Patient from "../models/patientModel.js";

const models = {
  receptionist: Receptionist,
  doctor: Doctor,
  patient: Patient,
};

// Register a new user based on role
export const registerUser = async (req, res) => {
  const { name, email, password, phone, role } = req.body;

  // Check for missing fields
  if (!name || !email || !password || !phone || !role) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Check if the role is valid
  if (!["receptionist", "doctor", "patient"].includes(role)) {
    return res.status(400).json({ message: "Invalid role specified." });
  }

  try {
    const Model = models[role];

    // Check if email is unique
    const existingUser = await Model.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: "Email already in use." });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create and save new user
    const newUser = new Model({
      name,
      email,
      password: hashedPassword,
      phone,
      role,
    });

    await newUser.save();
    res
      .status(201)
      .json({
        message: `${
          role.charAt(0).toUpperCase() + role.slice(1)
        } registered successfully.`,
      });
  } catch (error) {
    console.error("Error registering user:", error);
    res.status(500).json({ message: "Error registering user." });
  }
};

export const loginUser = async (req, res) => {
  const { email, password, role } = req.body;

  // Check for missing fields
  if (!email || !password || !role) {
    return res
      .status(400)
      .json({ message: "Email, password, and role are required." });
  }

  // Validate the role
  if (!["receptionist", "doctor", "patient"].includes(role)) {
    return res.status(400).json({ message: "Invalid role specified." });
  }

  try {
    const Model = models[role];

    // Find user by email within the specified role
    const user = await Model.findOne({ email });

    // Check if user exists
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Compare the provided password with the hashed password
    const isMatch = await bcrypt.compare(password, user.password);

    // If password does not match
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // If login is successful, respond with user details
    res
      .status(200)
      .json({ message: "Login successful", userId: user._id, role });
  } catch (error) {
    console.error("Error logging in:", error);
    res.status(500).json({ message: "Error logging in." });
  }
};