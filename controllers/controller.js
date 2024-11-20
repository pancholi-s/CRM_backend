import bcrypt from "bcryptjs";
import Receptionist from "../models/receptionistModel.js";
import Doctor from "../models/doctorModel.js";
import Patient from "../models/patientModel.js";
import Hospital from "../models/hospitalModel.js";

const models = {
  receptionist: Receptionist,
  doctor: Doctor,
  patient: Patient,
  Hospital:Hospital, 
};

// Register a new user based on role
// Register a new user based on role
export const registerUser = async (req, res) => {
  const { name, email, password, phone, role, hospitalName, ...additionalData } = req.body;

  // Check for missing fields
  if (!name || !email || !password || !phone || !role || !hospitalName) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Validate the role
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

    // Find the hospital by its name
    const hospital = await Hospital.findOne({ name: hospitalName });
    if (!hospital) {
      return res.status(400).json({ message: "Hospital not found." });
    }

    // Hash the password
    const hashedPassword = await bcrypt.hash(password, 10);

    // Create the user object
    const newUser = new Model({
      name,
      email,
      password: hashedPassword,
      phone,
      role,
      hospital: hospital._id, // Store the reference to the hospital
      ...additionalData, // Include additional fields based on the model
    });

    // Automatically set the registration date for patients
    if (role === "patient") {
      newUser.registrationDate = new Date();
    }

    // Save the user
    await newUser.save();

    res.status(201).json({
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