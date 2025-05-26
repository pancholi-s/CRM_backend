import Hospital from '../models/hospitalModel.js';
import Department from '../models/departmentModel.js';
import Doctor from '../models/doctorModel.js';
import Patient from '../models/patientModel.js';

export const addDepartment = async (req, res) => {
  const { name, head, nurses, services, doctors = [] } = req.body;

  if (!name || !head?.name || !head?.email) {
    return res.status(400).json({ message: "Department name and head doctor details are required." });
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

    // Find or create head doctor
    let headDoctor = await Doctor.findOne({ email: head.email, hospital: hospitalId });
    if (!headDoctor) {
      headDoctor = new Doctor({
        name: head.name,
        email: head.email,
        phone: head.phone || '',
        specialization: head.specialization || '',
        hospital: hospitalId,
        password: head.password,
        departments: [],
      });
      await headDoctor.save();
    }

    // Validate other doctors (optional)
    const validDoctorIds = [];
    for (const docId of doctors) {
      const doctor = await Doctor.findOne({ _id: docId, hospital: hospitalId });
      if (doctor) validDoctorIds.push(doctor._id);
    }

    // Add head doctor to the doctor list if not already present
    if (!validDoctorIds.includes(headDoctor._id)) {
      validDoctorIds.push(headDoctor._id);
    }

    const newDepartment = new Department({
      name,
      head: { id: headDoctor._id, name: headDoctor.name },
      doctors: validDoctorIds,
      nurses: nurses || [],
      services: services || [],
      hospital: hospitalId,
      patients: req.body.patients || [],
      facilities: req.body.facilities || [],
      specializedProcedures: req.body.specializedProcedures || [],
      criticalEquipments: req.body.criticalEquipments || [],
      equipmentMaintenance: req.body.equipmentMaintenance || [],
      appointments: [],
      specialistDoctors: [],
      rooms: [],
      staffs: []
    });

    await newDepartment.save();

    // Update the hospital document to include the new department and head doctor
    const updatedHospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      {
        $addToSet: {
          departments: newDepartment._id,
          doctors: headDoctor._id,
        },
      },
      { new: true }
    ).populate('departments');

    if (!updatedHospital) {
      return res.status(404).json({ message: "Hospital not found or failed to update." });
    }

    // Update head doctor to reference the department and set as head
    await Doctor.findByIdAndUpdate(
      headDoctor._id,
      {
        $addToSet: { departments: newDepartment._id },
        $set: { head: newDepartment._id },
      },
      { new: true }
    );

    // Update other doctors with department (except head if already updated)
    for (const docId of validDoctorIds) {
      if (docId.toString() !== headDoctor._id.toString()) {
        await Doctor.findByIdAndUpdate(
          docId,
          { $addToSet: { departments: newDepartment._id } },
          { new: true }
        );
      }
    }

    res.status(201).json({
      message: "Department created and linked with doctors.",
      department: newDepartment,
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
      .populate("doctors", "name phone email")
      .populate("head.id", "name phone email")
      .populate("services", "name")
      .populate("specialistDoctors", "name phone email")
      .populate("staffs", "name");

    if (!department) {
      return res.status(404).json({ message: "Department not found for this hospital." });
    }

    // Extracting doctor details
    const totalDoctors = department.doctors?.map((doc) => ({
      id: doc._id,
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
    })) || [];

    // Extracting department head details
    const departmentHead = department.head?.id
      ? {
          id: department.head.id._id,
          name: department.head.id.name,
          email: department.head.id.email,
          phone: department.head.id.phone,
        }
      : { id: null, name: "Not assigned", email: null, phone: null };

    // Ensure department head is included in total doctors if not already present
    if (department.head?.id && !totalDoctors.some((doc) => doc.id.equals(department.head.id._id))) {
      totalDoctors.push(departmentHead);
    }

    const specialistDoctors = department.specialistDoctors?.map((doc) => ({
      id: doc._id,
      name: doc.name,
      email: doc.email,
      phone: doc.phone,
    })) || [];

    const totalStaffs = department.staffs?.map((staff) => ({
      id: staff._id,
      name: staff.name,
    })) || [];

    // Extracting other department data
    const availableServices = department.services?.map((service) => service.name) || [];

    res.status(200).json({
      departmentName: department.name,
      departmentHead,
      totalDoctors,
      totalNurses: department.nurses ? department.nurses.length : 0,
      specialistDoctors,
      availableServices,
      facilities: department.facilities || [],
      criticalEquipment: department.criticalEquipments || [],
      specializedProcedures: department.specializedProcedures || [],
      equipmentMaintenance: department.equipmentMaintenance || [],
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
