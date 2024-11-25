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

    // Find the doctor
    const doctor = await Doctor.findOne({ email: doctorEmail, hospital: hospitalId });
    if (!doctor) {
      return res
        .status(404)
        .json({ message: "Doctor not found in this hospital." });
    }

    // Fetch the hospital and validate the department
    const hospital = await Hospital.findById(hospitalId).populate("departments");
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found." });
    }

    const department = hospital.departments.find(
      (dept) => dept.name.toLowerCase() === departmentName.toLowerCase()
    );

    if (!department) {
      return res.status(404).json({ message: "Department not found in this hospital." });
    }

    // Create and save the new appointment
    const newAppointment = new Appointment({
      patient: patient._id,
      doctor: doctor._id,
      type: appointmentType,
      department: department._id, // Use department's _id here
      tokenDate: date,
      status: status || "Scheduled",
      note,
      hospital: hospitalId, // Add hospitalId to the appointment for tracking
    });
  
    await newAppointment.save();
  
    // Update the hospital's appointments array
    await Hospital.findByIdAndUpdate(hospitalId, {
      $push: { appointments: newAppointment._id },
    });
  
    // Optional: Update the department's appointments array (if maintained)
    await Department.findByIdAndUpdate(department._id, {
      $push: { appointments: newAppointment._id },
    });
  
    res.status(201).json({
      message: "Appointment booked successfully.",
      appointment: newAppointment,
    });
  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json({ message: "Error booking appointment." });
  }
  
};
