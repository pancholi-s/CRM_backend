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

    // Validate hospital
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found." });
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
        hospital: hospitalId, // Link doctor to hospital
      });
      await headDoctor.save();
    }

    // Fetch all patient IDs (for future assignment)
    const allPatients = await Patient.find().select('_id');
    const patientIds = allPatients.map(patient => patient._id);

    // Fetch doctor IDs for the department (excluding the head doctor)
    const doctorIds = await Doctor.find({ _id: { $ne: headDoctor._id }, hospital: hospitalId }).select('_id');


    const newDepartment = new Department({
      name,
      head: { id: headDoctor._id, name: headDoctor.name },
      patients: patientIds || [],
      doctors: doctorIds,
      nurses: nurses || [],
      services: services || [],
      hospital: hospitalId, 
    });

    // Save the department
    await newDepartment.save();

    // Update the hospital document to include the new department
    const updatedHospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      {
        $push: {
          departments: newDepartment._id,
          doctors: headDoctor._id,
        },
      },
      { new: true }
    ).populate('departments'); // Ensure the hospital is populated with departments

    
    if (!updatedHospital) {
      return res.status(404).json({ message: "Hospital not found or failed to update." });
    }

    // Update the head doctor's document to reference the new department
    await Doctor.findByIdAndUpdate(
      headDoctor._id,
      { $push: { departments: newDepartment._id } }, // Add the new department to the head doctor's departments array
      { new: true }
    );
 
    res.status(201).json({
      message: "Department created and hospital updated successfully.",
      department: newDepartment,
      hospital: updatedHospital,
    });

  } catch (error) {
    console.error("Error creating department:", error);
    res.status(500).json({ message: "Error creating department." });
  }
};

export const getDepartments = async (req, res) => {
  const { departmentId } = req.params;

  try {
    // Retrieve hospitalId from the session
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "Hospital context not found in session." });
    }

    // Find the hospital and populate the departments field
    const hospital = await Hospital.findById(hospitalId).populate({
      path: "departments",
      populate:[ 
        { path: "doctors" },
        { path: "head.id" }, // Populate department head details
      ], // Populate doctors within departments
    });

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found." });
    }

    // Use the `find` method to locate the department by its `_id`
    const department = hospital.departments.find(
      (dept) => dept._id.toString() === departmentId
    );

    if (!department) {
      return res.status(404).json({ message: "Department not found in this hospital." });
    }

    // Fetch total doctors with names
    const totalDoctors = department.doctors.map(doctor => doctor.name);
    
    // Fetch department head's name
    const departmentHead = department.head?.id?.name || "Not assigned";

    // Ensure department head is included in `totalDoctors`
    if (department.head?.id && !totalDoctors.includes(departmentHead)) {
      totalDoctors.push(departmentHead);
    }

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
      departmentHead,
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
    // Retrieve hospitalId from the session
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "Hospital context not found in session." });
    }

    // Fetch the hospital and populate the departments array along with services
    const hospital = await Hospital.findById(hospitalId)
      .populate({
        path: "departments",
        populate: [
          { path: "head", populate: { path: "id" } }, // Populate head of department details
          { path: "specialistDoctors" }, // Populate specialist doctors
          { path: "doctors" }, // Populate doctors
          { path: "patients" }, // Populate patients
          { path: "services", select: "name" }, // Populate service names
        ],
      });

    // Check if the hospital was found
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found." });
    }

    // Check if the hospital has departments
    if (!hospital.departments || hospital.departments.length === 0) {
      return res.status(404).json({ message: "No departments found for the given hospital." });
    }

    // Map departments to extract required details
    const response = hospital.departments.map(department => ({
      departmentId: department._id,
      departmentName: department.name,
      departmentHead: department.head?.id?.name || "Not Assigned",
      totalPatients: department.patients.length,
      specialistDocs: department.specialistDoctors.length,
      Docs: department.doctors.length,
      totalNurses: department.nurses.length,
      activeServices: department.services.map(service => service.name), // Extract service names
      facilities: department.facilities || [],
      criticalEquipment: department.criticalEquipment || [],
      equipmentMaintenance: department.equipmentMaintenance || [],
    }));

    // Send response
    res.status(200).json(response);

  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ message: "Error fetching departments." });
  }
};

