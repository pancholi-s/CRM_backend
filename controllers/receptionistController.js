import bcrypt from 'bcryptjs';
import Receptionist from '../models/receptionistModel.js';

// Add a new receptionist
export const addReceptionist = async (req, res) => {
  const { name, email, password, phone } = req.body;

  // Check for missing fields
  if (!name || !email || !password || !phone) {
    return res.status(400).json({ message: "All fields are required." });
  }

  // Check if email is unique
  const existingReceptionist = await Receptionist.findOne({ email });
  if (existingReceptionist) {
    return res.status(400).json({ message: "Email already in use." });
  }

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Save new receptionist
  const newReceptionist = new Receptionist({
    name,
    email,
    password: hashedPassword,
    phone,
  });

  try {
    await newReceptionist.save();
    res.status(201).json({ message: "Receptionist added successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error adding receptionist." });
  }
};

// Get all receptionists
export const getReceptionists = async (req, res) => {
  try {
    const receptionists = await Receptionist.find().populate('appointmentsHandled');
    res.status(200).json(receptionists);
  } catch (error) {
    console.error('Error fetching receptionists:', error); // Log the error
    res.status(500).json({ message: "Error fetching receptionists." });
  }
};

// Login a receptionist
export const loginReceptionist = async (req, res) => {
  const { email, password } = req.body;

  // Check for missing fields
  if (!email || !password) {
    return res.status(400).json({ message: "Email and password are required." });
  }

  try {
    // Find the receptionist by email
    const receptionist = await Receptionist.findOne({ email });
    
    // Check if receptionist exists
    if (!receptionist) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // Compare the provided password with the hashed password
    const isMatch = await bcrypt.compare(password, receptionist.password);
    
    // If password does not match
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials." });
    }

    // If login is successful
    res.status(200).json({ message: "Login successful", receptionistId: receptionist._id });
  } catch (error) {
    res.status(500).json({ message: "Error logging in." });
  }
};