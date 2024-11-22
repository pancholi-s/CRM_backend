import Appointment from "../models/appointmentModel.js";
import Patient from "../models/patientModel.js";
import Doctor from "../models/doctorModel.js";
import Department from "../models/departmentModel.js";
import Hospital from "../models/hospitalModel.js";

export const bookAppointment = async (req, res) => {
  const {
    patientName,
    appointmentType,
    departmentName,
    doctorEmail,
    mobileNumber,
    email,
    date,
    note,
    status,
  } = req.body;

  const { hospitalId } = req.session; // Extract hospitalId from session

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Access denied. No hospital context found." });
  }

  if (
    !patientName ||
    !appointmentType ||
    !departmentName ||
    !doctorEmail ||
    !mobileNumber ||
    !email ||
    !date
  ) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Find the patient
    const patient = await Patient.findOne({ email });
    if (!patient) {
      return res
        .status(404)
        .json({ message: "Patient not found in this hospital." });
    }
    console.log("Found Patient:", patient);

    // Find the doctor
    const doctor = await Doctor.findOne({ email: doctorEmail, hospital: hospitalId });
    if (!doctor) {
      return res
        .status(404)
        .json({ message: "Doctor not found in this hospital." });
    }
    console.log("Found Doctor:", doctor);

    // Fetch the hospital and validate the department
    const hospital = await Hospital.findById(hospitalId).populate("departments");
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found." });
    }
    console.log("Hospital Departments:", hospital.departments);

    // Find the department by name
    const department = await Department.findOne({ name: departmentName });
    if (!department) {
      return res.status(404).json({ message: "Department not found." });
    }
    console.log("Found Department:", department);

    // Check if the department belongs to the hospital
    const isDepartmentInHospital = hospital.departments.some(
      (dept) => dept.toString() === department._id.toString()
    );
    console.log(
      `Department Validation - Is in hospital? ${isDepartmentInHospital}`
    );

    if (!isDepartmentInHospital) {
      return res.status(404).json({
        message: "Department not found in this hospital.",
      });
    }

    // Create and save the new appointment
    const newAppointment = new Appointment({
      patient: patient._id,
      doctor: doctor._id,
      type: appointmentType,
      department: department._id, // Use department's _id here
      tokenDate: date,
      status: status,
      note,
      hospital: hospitalId, // Add hospitalId to the appointment for tracking
    });

    await newAppointment.save();
    console.log("New Appointment Created:", newAppointment);

    res.status(201).json({
      message: "Appointment booked successfully.",
      appointment: newAppointment,
    });
  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json({ message: "Error booking appointment." });
  }
};
