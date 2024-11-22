// Function to add a new department
import Department from '../models/departmentModel.js';
import Patient from '../models/patientModel.js';
import Doctor from '../models/doctorModel.js';
import Hospital from '../models/hospitalModel.js';
import bcrypt from 'bcryptjs';

export const addDepartment = async (req, res) => {
  const { name, head, nurses, services } = req.body;

  if (!name || !head || !head.name) {
    return res.status(400).json({ message: "Department name and head details are required." });
  }

  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Hospital context not found." });
    }

    // Check if the head doctor already exists in the database
    let headDoctor = await Doctor.findOne({ name: head.name });

    // If head doctor doesn't exist, create a new one
    if (!headDoctor) {
      const { email, password, phone } = head;
      if (!email || !password || !phone) {
        return res.status(400).json({ message: "Email, password, and phone are required to create a new head doctor." });
      }

      // Hash the password for the new head doctor
      const hashedPassword = await bcrypt.hash(password, 10);

      // Create the new head doctor
      headDoctor = new Doctor({
        name: head.name,
        email,
        password: hashedPassword,
        phone,
        role: 'Head',
        specialization: 'Department Head',
        hospital: hospitalId,
      });
      await headDoctor.save();
    }

    // Fetch all patient IDs (for future assignment)
    const allPatients = await Patient.find().select('_id');
    const patientIds = allPatients.map(patient => patient._id);

    // Fetch doctor IDs for the department (excluding the head doctor)
    const doctorIds = await Doctor.find({ _id: { $ne: headDoctor._id }, hospital: hospitalId }).select('_id');
    
    // Create a new department
    const newDepartment = new Department({
      name,
      head: { id: headDoctor._id, name: headDoctor.name },
      patients: patientIds || [],
      doctors: doctorIds,
      nurses: nurses || [],
      services: services || [],
    });

    // Save the department
    await newDepartment.save();

    // Update the hospital document to include the new department
    const updatedHospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      { 
        $push: { 
          departments: newDepartment._id,
          doctors: headDoctor._id 
        }
      },
      { new: true }
    ).populate('departments');  // Ensure the hospital is populated with the departments

    // Check if the update was successful
    if (!updatedHospital) {
      return res.status(404).json({ message: "Hospital not found or failed to update." });
    }

    // Return the newly updated hospital with the new department
    res.status(201).json({
      message: "Department created and hospital updated successfully.",
      department: newDepartment,
      hospital: updatedHospital
    });

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
