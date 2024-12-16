import mongoose from "mongoose";
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

  const { hospitalId } = req.session;

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

  //to avoid differences in the last digit of object id stored as references in patient  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Find the patient
    const patient = await Patient.findOne({ email, hospital: hospitalId });
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
      department: department._id,
      tokenDate: date,
      status: status || "Scheduled",
      note,
      hospital: hospitalId,
    });

    await newAppointment.save({ session });

    // Log for debugging
    console.log("New Appointment Created:", newAppointment);

    // Update the patient's appointments array with the correct _id
    // Update the patient's appointments array and ensure doctor is only added once
    const updatedPatient = await Patient.findByIdAndUpdate(
      patient._id,
      {
        $push: { appointments: { _id: newAppointment._id } }, // Push appointment ID
        $addToSet: { doctors: doctor._id }, // Add doctor ID only if not already present
      },
      { session, new: true }
    );

      // Update the doctor's appointments and patients arrays
    const updatedDoctor = await Doctor.findByIdAndUpdate(
      doctor._id,
      {
        $push: { appointments: newAppointment._id },
        $addToSet: { patients: patient._id },
      },
      { session, new: true }
    );


    // Log the updated patient appointments array
    console.log("Updated Patient Appointments:", updatedPatient.appointments);
    console.log("Updated Patient Doctors Array:", updatedPatient.doctors);

    // Update the hospital's appointments array
    await Hospital.findByIdAndUpdate(
      hospitalId,
      { $push: { appointments: newAppointment._id } },
      { session, new: true }
    );

    // Optional: Update the department's appointments array (if maintained)
    await Department.findByIdAndUpdate(
      department._id,
      { $push: { appointments: newAppointment._id } },
      { session, new: true }
    );

    

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Appointment booked successfully.",
      appointment: newAppointment,
      updatedPatientAppointments: updatedPatient.appointments,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error booking appointment:", error);
    res.status(500).json({ message: "Error booking appointment.", error: error.message });
  }
};
