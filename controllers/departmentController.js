import Department from '../models/departmentModel.js';
import Patient from '../models/patientModel.js';
import Doctor from '../models/doctorModel.js';

// Function to add a new department
export const addDepartment = async (req, res) => {
  const {
    name,
    head,
    patients,
    doctors,
    specialistDoctors, // This field is optional
    nurses,
    services,
  } = req.body;

  // Validate required fields
  if (!name || !head || !head.id || !head.name) {
    return res.status(400).json({ message: "Name and head details are required." });
  }

  try {
    // Validate and fetch patients from the database
    const fetchedPatients = [];
    if (patients && patients.length > 0) {
      for (const patientId of patients) {
        const patient = await Patient.findById(patientId);
        if (patient) {
          fetchedPatients.push(patientId); // Collect existing patient IDs
        } else {
          console.warn(`Patient with ID ${patientId} not found.`);
        }
      }
    }

    // Validate and fetch doctors from the database
    const fetchedDoctors = [];
    if (doctors && doctors.length > 0) {
      for (const doctorId of doctors) {
        const doctor = await Doctor.findById(doctorId);
        if (doctor) {
          fetchedDoctors.push(doctorId); // Collect existing doctor IDs
        } else {
          console.warn(`Doctor with ID ${doctorId} not found.`);
        }
      }
    }

    // Optionally validate and fetch specialist doctors from the database
    const fetchedSpecialistDoctors = [];
    if (specialistDoctors && specialistDoctors.length > 0) {
      for (const specialistId of specialistDoctors) {
        const specialistDoctor = await Doctor.findById(specialistId);
        if (specialistDoctor) {
          fetchedSpecialistDoctors.push(specialistId); // Collect existing specialist doctor IDs
        } else {
          console.warn(`Specialist doctor with ID ${specialistId} not found.`);
          // No error is thrown if a specialist doctor is missing
        }
      }
    }

    // Create a new department with fetched patients and doctors
    const newDepartment = new Department({
      name,
      head,
      patients: fetchedPatients,
      doctors: fetchedDoctors,
      specialistDoctors: fetchedSpecialistDoctors, // This can be empty if no valid specialist doctors are found
      nurses: nurses || [], // Default to empty array if not provided
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
      .populate('patients')         // Optional: Populate patients details
      .populate('doctors')          // Optional: Populate doctors details
      .populate('specialistDoctors') // Optional: Populate specialist doctors details
      .populate('nurses');          // Optional: Populate nurses details

    res.status(200).json(departments);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ message: "Error fetching departments." });
  }
};
