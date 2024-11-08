import Appointment from "../models/appointmentModel.js";
import Patient from "../models/patientModel.js";
import Doctor from "../models/doctorModel.js";
import Department from "../models/departmentModel.js";  // Import Department model

export const bookAppointment = async (req, res) => {
  const {
    patientName,
    appointmentType,
    departmentName,  // Change to departmentName for clarity
    doctorEmail,
    mobileNumber,
    email,
    date,
    note
  } = req.body;

  if (!patientName || !appointmentType || !departmentName || !doctorEmail || !mobileNumber || !email || !date) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    // Check if the patient exists by email
    const patient = await Patient.findOne({ email });
    if (!patient) {
      return res.status(404).json({ message: "Patient not found." });
    }

    // Fetch the doctor by email
    const doctor = await Doctor.findOne({ email: doctorEmail });
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found." });
    }

    // Fetch the department by name
    const department = await Department.findOne({ name: departmentName });
    if (!department) {
      return res.status(404).json({ message: "Department not found." });
    }

    // Create and save the new appointment
    const newAppointment = new Appointment({
      patient: patient._id,
      doctor: doctor._id,
      type: appointmentType,
      department: department._id,  // Use department's _id here
      tokenDate: date,
      status: 'Scheduled',
      note,
    });

    await newAppointment.save();
    res.status(201).json({ message: "Appointment booked successfully.", appointment: newAppointment });
  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json({ message: "Error booking appointment." });
  }
};
