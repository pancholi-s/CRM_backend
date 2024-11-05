import Appointment from "../models/appointmentModel.js";
import Patient from "../models/patientModel.js";
import Doctor from "../models/doctorModel.js";

// Function to book a new appointment
export const bookAppointment = async (req, res) => {
  const {
    patientName,
    appointmentType,
    departmentId,
    doctorEmail,
    mobileNumber,
    email,
    date,
    note,
    status
  } = req.body;

  //Department name fetch in booking, according to UI/UX figma

  // Validate required fields
  //main ->   if (!patientName || !appointmentType || !departmentId || !doctorEmail || !mobileNumber || !email || !date) {
  if (!patientName || !appointmentType || !doctorEmail || !mobileNumber || !email || !date) {
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

    // Create and save the new appointment
    const newAppointment = new Appointment({
      patient: patient._id,  // Use fetched patient's ID
      doctor: doctor._id,    // Use fetched doctor's ID
      type: appointmentType,
      department: departmentId,
      tokenDate: date,
      status: status, // Set default status
      note,  // Save the note
    });

    await newAppointment.save();
    res.status(201).json({ message: "Appointment booked successfully.", appointment: newAppointment });
  } catch (error) {
    console.error("Error booking appointment:", error);
    res.status(500).json({ message: "Error booking appointment." });
  }
};