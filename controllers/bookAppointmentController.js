import mongoose from "mongoose";
import Appointment from "../models/appointmentModel.js";
import RejectedAppointment from '../models/rejectedAppointmentModel.js';
import Patient from "../models/patientModel.js";
import Doctor from "../models/doctorModel.js";
import Department from "../models/departmentModel.js";
import Hospital from "../models/hospitalModel.js";

// direct booking of appointment withoput request and approval
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
    const patient = await Patient.findOne({ email, hospital: hospitalId });
    if (!patient) {
      return res
        .status(404)
        .json({ message: "Patient not found in this hospital." });
    }

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
      { $push: { appointments: newAppointment._id },$addToSet: { patients: patient._id }, },
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

export const completeAppointment = async (req, res) => {
  const { appointmentId, note } = req.body;

  try {
    // Find the appointment
    const appointment = await Appointment.findById(appointmentId);
    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    // Update status and notes
    appointment.status = "Completed";
    // appointment.note = note;
    appointment.note = appointment.note ? `${appointment.note}\n${note}` : note;

    await appointment.save();

    res.status(200).json({ message: "Appointment completed successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error updating appointment.", error: error.message });
  }
};

//get info about patients's appointment (active/inactive filtering) 
export const getAppointmentsByStatus = async (req, res) => {
  const { status } = req.query;

  try {
    // Retrieve hospitalId from the session
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    let appointments;

    // If status is 'Scheduled', fetch all appointments regardless of status
    if (status === 'Scheduled') {
      appointments = await Appointment.find({ hospital: hospitalId })
        .populate('patient', 'name email')
        .populate('doctor', 'name email')
        .populate('department', 'name')
        .populate('hospital', 'name address');
    } else if (status) {
      // Otherwise, filter by the provided status and hospitalId
      appointments = await Appointment.find({ status, hospital: hospitalId })
        .populate('patient', 'name email')
        .populate('doctor', 'name email')
        .populate('department', 'name')
        .populate('hospital', 'name address');
    } else {
      return res.status(400).json({ message: 'Status query parameter is required.' });
    }

    // Count of retrieved appointments
    const count = appointments.length;

    res.status(200).json({
      message: `${status || 'All'} appointments retrieved successfully`,
      count,
      appointments,
    });
  } catch (error) {
    console.error(`Error fetching appointments:`, error);
    res.status(500).json({ message: 'Error fetching appointments' });
  }
};

export const getFilteredAppointments = async (req, res) => {
  const { departmentId, status } = req.query;

  try {
    // Retrieve hospitalId from the session
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    // Validate the status
    const validStatuses = Appointment.schema.path('status').enumValues;
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid or missing appointment status.' });
    }

    // Retrieve the hospital and populate departments
    const hospital = await Hospital.findById(hospitalId).populate('departments');
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found.' });
    }

    // Ensure departmentId is a valid ObjectId
    const departmentObjectId = new mongoose.Types.ObjectId(departmentId);

    // Check if the department belongs to the hospital
    const isDepartmentValid = hospital.departments.some(
      (dep) => dep._id.toString() === departmentObjectId.toString()
    );
    if (!isDepartmentValid) {
      return res
        .status(404)
        .json({ message: 'Department does not belong to the specified hospital.' });
    }

    // Fetch appointments filtered by departmentId, status, and hospitalId
    const appointments = await Appointment.find({
      department: departmentObjectId,
      status: status,
      hospital: hospitalId,
    })
      .populate('patient', 'name email')
      .populate('doctor', 'name email')
      .populate('department', 'name')
      .populate('hospital', 'name address');

    // Count of filtered appointments
    const count = appointments.length;

    res.status(200).json({
      message: 'Filtered appointments retrieved successfully',
      count,
      appointments,
    });
  } catch (error) {
    console.error('Error fetching filtered appointments:', error);
    res.status(500).json({ message: 'Error fetching filtered appointments' });
  }
};

export const getAppointmentCounts = async (req, res) => {
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({ message: 'Unauthorized access. Hospital ID not found in session.' });
  }

  try {
    const completedCount = await Appointment.countDocuments({ hospital: hospitalId, status: 'Completed' });
    const cancelledCount = await RejectedAppointment.countDocuments({ hospital: hospitalId });

    const totalCount = completedCount + cancelledCount;

    res.status(200).json({
      completedCount,
      cancelledCount,
      totalCount,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get appointment counts.', error: error.message });
  }
};

export const getRejectedAppointments = async (req, res) => {
  const { hospitalId } = req.session; // Retrieve hospital context from session

  // Validate hospitalId
  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  try {
    const rejectedAppointments = await RejectedAppointment.find({ hospital: hospitalId })
      .populate('patient', 'name email phone')
      .populate('doctor', 'name email specialization')
      .populate('department', 'name')
      .sort({ dateRejected: -1 });

    // Count of rejected appointments
    const count = rejectedAppointments.length;

    res.status(200).json({
      message: "Rejected appointments retrieved successfully.",
      count,
      rejectedAppointments,
    });
  } catch (error) {
    console.error('Error fetching rejected appointments:', error);
    res.status(500).json({
      message: "Error fetching rejected appointments.",
      error: error.message,
    });
  }
};

export const getAppointmentsByVisitType = async (req, res) => {
  try {
    const { typeVisit } = req.query;
    const hospitalId = req.session.hospitalId;

    // Validate typeVisit
    const validVisitTypes = ['Walk in', 'Referral', 'Online'];
    if (!typeVisit || !validVisitTypes.includes(typeVisit)) {
      return res.status(400).json({
        message: "Invalid visit type. Use 'Walk in', 'Referral', or 'Online'.",
      });
    }

    if (!hospitalId) {
      return res.status(403).json({ message: 'Access denied. No hospital context found.' });
    }

    // Fetch appointments based on visit type and hospital context
    const appointments = await Appointment.find({
      typeVisit: typeVisit,
      hospital: hospitalId,
    })
      .populate('patient', 'name email phone')
      .populate('doctor', 'name specialization')
      .populate('department', 'name')
      .select('-__v');

    res.status(200).json({
      hospitalId: hospitalId,
      typeVisit: typeVisit,
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error('Error fetching appointments by visit type:', error);
    res.status(500).json({
      message: 'Failed to fetch appointments.',
      error: error.message,
    });
  }
};
