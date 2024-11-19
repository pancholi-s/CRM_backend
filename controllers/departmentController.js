import Department from '../models/departmentModel.js';
import Patient from '../models/patientModel.js';
import Doctor from '../models/doctorModel.js';
import Appointment from '../models/appointmentModel.js';

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
      patients: patientIds || [],
      doctors: doctorIds,
      specialistDoctors: [], // Will populate dynamically if needed
      nurses: nurses || [], // Accepts an array of strings as nurse names
      services: services || [], // Default to empty array if not provided
    });

    await newDepartment.save();
    res.status(201).json({ message: "Department created successfully.", department: newDepartment });

    // Dynamically assign patients to this department
    const patientsInDepartment = await Patient.find({ department: newDepartment._id }).select('_id');
    newDepartment.patients = patientsInDepartment.map(patient => patient._id);

    // Save again with updated patients
    await newDepartment.save();

  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({ message: "Error creating department." });
  }
};

export const getDepartments = async (req, res) => {
  const { departmentId } = req.params;

  try {
    // Find the department by ID
    const department = await Department.findById(departmentId).populate('doctors specialistDoctors');

    if (!department) {
      return res.status(404).json({ message: "Department not found." });
    }

    // Fetch total doctors with names
    const totalDoctors = department.doctors.map(doctor => doctor.name);

    // Fetch total nurses (names already stored as strings in the schema)
    const totalNurses = department.nurses;

    // Fetch specialist doctors (only names)
    const specialistDoctors = department.specialistDoctors.map(doc => doc.name);

    // Fetch available services (already stored as names in the schema)
    const availableServices = department.services;

    // Fetch facilities, critical equipment, and maintenance details (if these are added to the schema later)
    const facilities = department.facilities || []; // Replace with schema property if defined
    const criticalEquipment = department.criticalEquipment || []; // Replace with schema property if defined
    const equipmentMaintenance = department.equipmentMaintenance || []; // Replace with schema property if defined

    // Send response
    res.status(200).json({
      departmentName: department.name,
      totalDoctors,
      totalNurses,
      specialistDoctors,
      availableServices,
      facilities,
      criticalEquipment,
      equipmentMaintenance,
    });

  } catch (error) {
    console.error("Error fetching department:", error);
    res.status(500).json({ message: "Error fetching department details." });
  }
};

export const getAllDepartments = async (req, res) => {
  try {
    // Fetch all departments and populate necessary references
    const departments = await Department.find()
      .populate('head.id') // Populate department head details
      .populate('specialistDoctors') // Populate specialist doctors
      .populate('doctors') // Populate doctors
      .populate('patients'); // Populate patients to calculate count

    if (!departments.length) {
      return res.status(404).json({ message: "No departments found." });
    }

    // Map departments to extract required details
    const response = departments.map(department => {
      return {
        departmentName: department.name,
        departmentHead: department.head.name, // Assuming `head` has `name`
        totalPatients: department.patients.length, // Count of patients
        specialistDocs: department.specialistDoctors.length, // Count of specialist doctors
        Docs: department.doctors.length, // Count of doctors
        totalNurses: department.nurses.length, // Count of nurses
        activeServices: department.services.join(', '), // Convert array to comma-separated string
      };
    });

    // Send response
    res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ message: "Error fetching departments." });
  }
};
