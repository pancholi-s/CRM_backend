import Hospital from '../models/hospitalModel.js';
import Department from '../models/departmentModel.js';
import Doctor from '../models/doctorModel.js';
import Patient from '../models/patientModel.js';
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

    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found." });
    }

    // Check if the head doctor already exists in the database
    let headDoctor = await Doctor.findOne({ name: head.name });

    // change password, ph_no when add dept page is created

    // If head doctor doesn't exist, create a new one
    if (!headDoctor) {
      const { email, password, phone, specialization } = head;
      if (!email || !phone) {
        return res.status(400).json({ message: "Email, and phone are required to create a new head doctor." });
      }

      const defaultPassword = "changeme123";
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      // Create the new head doctor
      headDoctor = new Doctor({
        name: head.name,
        email,
        password: hashedPassword,
        phone,
        role: 'Doctor',
        specialization,
        hospital: hospitalId,
      });
      await headDoctor.save();
    }

    // // Fetch all patient IDs (for future assignment)
    // const allPatients = await Patient.find().select('_id');
    // const patientIds = allPatients.map(patient => patient._id);

    // // Fetch doctor IDs for the department (excluding the head doctor)
    // const doctorIds = await Doctor.find({ _id: { $ne: headDoctor._id }, hospital: hospitalId }).select('_id');


    const newDepartment = new Department({
      name,
      head: { id: headDoctor._id, name: headDoctor.name },
      patients: req.body.patients || [],    // Only add patients if provided
      doctors: [...(req.body.doctors || []), headDoctor._id],
      nurses: nurses || [],
      services: services || [],
      hospital: hospitalId,
      facilities: req.body.facilities || [],
      specializedProcedures: req.body.specializedProcedures || [],
      criticalEquipments: req.body.criticalEquipments || [],
      equipmentMaintenance: req.body.equipmentMaintenance || [],
      appointments: [],
      specialistDoctors: [],
      rooms: [],
      staffs: []                     
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
      { $push: { departments: newDepartment._id }, $set: { head: newDepartment._id }  },
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
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "Hospital context not found in session." });
    }

    // Find the department for the specific hospital
    const department = await Department.findOne({
      _id: departmentId,
      hospital: hospitalId,
    })
      .populate("doctors", "name")
      .populate("head.id", "name")
      .populate("services", "name")
      .populate("specialistDoctors", "name")
      .populate("staffs", "name");

    if (!department) {
      return res.status(404).json({ message: "Department not found for this hospital." });
    }

    // Extract department data, ensuring all fields return valid arrays
    const totalDoctors = department.doctors?.map((doctor) => doctor.name).filter(Boolean) || [];
    const departmentHead = department.head?.id?.name || "Not assigned";

    if (department.head?.id && !totalDoctors.includes(departmentHead)) {
      totalDoctors.push(departmentHead);
    }

    const availableServices = department.services?.map((service) => service.name).filter(Boolean) || [];
    const specialistDoctors = department.specialistDoctors?.map((doc) => doc.name).filter(Boolean) || [];

    // Now directly accessing fields instead of populating
    const facilities = department.facilities || [];
    const criticalEquipment = department.criticalEquipments || [];
    const specializedProcedures = department.specializedProcedures || [];
    const equipmentMaintenance = department.equipmentMaintenance || [];
    const totalNurses = department.nurses ? department.nurses.length : 0;
    const totalStaffs = department.staffs?.map((staff) => staff.name).filter(Boolean) || [];

    res.status(200).json({
      departmentName: department.name,
      totalDoctors,
      departmentHead,
      totalNurses,
      specialistDoctors,
      availableServices,
      facilities,
      criticalEquipment,
      specializedProcedures,
      equipmentMaintenance,
      totalStaffs,
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
          { path: "head.id", select: "name email phone" },
          { path: "specialistDoctors", select: "name email phone" },
          { path: "doctors", select: "name email phone" },
          { path: "patients" },
          { path: "services", select: "name" },
        ],
      });

    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found." });
    }

    // Check if the hospital has departments
    if (!hospital.departments || hospital.departments.length === 0) {
      return res.status(404).json({ message: "No departments found for the given hospital." });
    }

    // Map departments to extract required details
    const response = hospital.departments.map((department) => ({
      departmentId: department._id,
      departmentName: department.name,
      departmentHead: department.head?.id
        ? {
            name: department.head.id.name,
            email: department.head.id.email,
            phone: department.head.id.phone,
          }
        : "Not Assigned",
      totalPatients: department.patients.length,
      specialistDocs: department.specialistDoctors.map((doc) => ({
        id: doc._id,
        name: doc.name,
        email: doc.email,
        phone: doc.phone,
      })),
      doctors: department.doctors.map((doc) => ({
        id: doc._id,
        name: doc.name,
        email: doc.email,
        phone: doc.phone,
      })),
      totalNurses: department.nurses.length,
      activeServices: department.services.map((service) => service.name),
      facilities: department.facilities || [],
      criticalEquipment: department.criticalEquipment || [],
      equipmentMaintenance: department.equipmentMaintenance || [],
    }));

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching departments:", error);
    res.status(500).json({ message: "Error fetching departments." });
  }
};
