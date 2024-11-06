import Department from '../models/departmentModel.js';
import Patient from '../models/patientModel.js';
import Doctor from '../models/doctorModel.js';
import bcrypt from 'bcryptjs';

// Function to add a new department
export const addDepartment = async (req, res) => {
  const {
    name,
    head,
    nurses,  // Now accepts an array of strings instead of nurse IDs
    services,
  } = req.body;

  // Validate required fields
  if (!name || !head || !head.name) {
    return res.status(400).json({ message: "Department name and head details are required." });
  }

  try {
    // Check if a doctor already exists with the provided head name
    let headDoctor = await Doctor.findOne({ name: head.name });

    // If the doctor doesn't exist, create a new doctor for the head
    if (!headDoctor) {
      // Ensure required fields are provided for creating a new doctor
      const { email, password, phone } = head;  // Assuming these are included in the head object
      if (!email || !password || !phone) {
        return res.status(400).json({ message: "Email, password, and phone are required to create a new head doctor." });
      }

      // Hash the password before saving (if applicable)
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create a new doctor for the head
      headDoctor = new Doctor({
        name: head.name,
        email,
        password: hashedPassword,
        phone,
        role: 'Head', // Assuming the role can be assigned here, modify as needed
        specialization: 'Department Head', // Optional, modify based on your schema
      });
      await headDoctor.save();
      console.log(`New head doctor created with ID: ${headDoctor._id}`);
    }

    // Fetch all patients dynamically for the department
    const allPatients = await Patient.find().select('_id');
    const patientIds = allPatients.map(patient => patient._id);

    // Fetch all doctors dynamically for the department (excluding head)
    const doctorIds = await Doctor.find({ _id: { $ne: headDoctor._id } }).select('_id');
    
    // Create a new department
    const newDepartment = new Department({
      name,
      head: {
        id: headDoctor._id, // Automatically assign the head doctor ID
        name: headDoctor.name, // Assign the head doctor's name
      },
      patients: patientIds,
      doctors: doctorIds,
      specialistDoctors: [], // Will populate dynamically if needed
      nurses: nurses || [], // Accepts an array of strings as nurse names
      services: services || [], // Default to empty array if not provided
    });

    await newDepartment.save();
    res.status(201).json({ message: "Department created successfully.", department: newDepartment });
  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({ message: "Error creating department." });
  }
};

// Function to retrieve all departments
export const getDepartments = async (req, res) => {
  try {
    const departments = await Department.find()

    .select('name') // Only select the 'name' field
    
      .populate('head', 'name') // Optionally, populate the head's name if you need it
      .populate('patients')         // Optional: Populate patients details
      .populate('doctors')          // Optional: Populate doctors details
      .populate('specialistDoctors') // Optional: Populate specialist doctors details
      .populate('nurses');          // Optional: Nurses will be populated as strings

    res.status(200).json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ message: "Error fetching departments." });
  }
};
