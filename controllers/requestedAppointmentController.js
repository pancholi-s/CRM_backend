import mongoose from 'mongoose';
import Appointment from '../models/appointmentModel.js';
import RequestedAppointment from '../models/requestedAppointmentModel.js';
import RejectedAppointment from '../models/rejectedAppointmentModel.js';

import Patient from '../models/patientModel.js';
import Doctor from '../models/doctorModel.js';
import Department from '../models/departmentModel.js';
import Hospital from '../models/hospitalModel.js';

// Book Appointment Request
export const requestAppointment = async (req, res) => {
  const {
    patientName,
    appointmentType,
    doctorEmail,
    mobileNumber,
    email,
    date,
    note,
    status,
    departmentName,
  } = req.body;

  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({ message: 'Unauthorized access. Hospital ID not found in session.' });
  }

  if (!patientName || !appointmentType || !doctorEmail || !mobileNumber || !email || !date || !departmentName) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const patient = await Patient.findOne({ email, hospital: hospitalId });
    if (!patient) return res.status(404).json({ message: 'Patient not found.' });

    const doctor = await Doctor.findOne({ email: doctorEmail, hospital: hospitalId });
    if (!doctor) return res.status(404).json({ message: 'Doctor not found.' });

    const hospital = await Hospital.findById(hospitalId).populate('departments');
    const department = hospital.departments.find(
      (dept) => dept.name.toLowerCase() === departmentName.toLowerCase()
    );

    if (!department) return res.status(404).json({ message: 'Department not found.' });

    const newRequest = new RequestedAppointment({
      patient: patient._id,
      doctor: doctor._id,
      type: appointmentType,
      department: department._id,
      tokenDate: date,
      status: status || 'Pending',
      typeVisit: 'Online',
      note,
      hospital: hospitalId,
    });

    await newRequest.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Appointment request sent successfully.', request: newRequest });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Error processing request.', error: error.message });
  }
};

export const getRequestedAppointments = async (req, res) => {
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: 'Unauthorized access. Hospital ID not found in session.' });
  }

  // Get the logged-in doctor's ID from the middleware
  const loggedInDoctorId = req.user._id;

  // Verify the user is a doctor
  if (req.user.role !== 'doctor') {
    return res
      .status(403)
      .json({ message: 'Access denied. Only doctors can access this endpoint.' });
  }

  const { patientId, departmentName, status } = req.query;

  try {
    // Build a filter object for the query - ALWAYS filter by logged-in doctor
    const filters = { 
      hospital: hospitalId,
      doctor: loggedInDoctorId // Only show appointments for the logged-in doctor
    };

    // Add optional filters
    if (patientId) filters.patient = patientId;
    if (status) filters.status = status;

    // Filter by department name if provided
    if (departmentName) {
      const department = await Department.findOne({
        name: departmentName,
        hospital: hospitalId,
      });
      if (!department) {
        return res
          .status(404)
          .json({ message: `Department '${departmentName}' not found.` });
      }
      filters.department = department._id;
    }

    // Fetch requested appointments based on filters
    const requestedAppointments = await RequestedAppointment.find(filters)
      .populate('patient', 'name email mobileNumber')
      .populate('doctor', 'name email')
      .populate('department', 'name')
      .sort({ tokenDate: 1 }); // Sort by appointment date

    res.status(200).json({
      message: 'Requested appointments fetched successfully.',
      appointments: requestedAppointments,
    });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching appointments.', error: error.message });
  }
};

export const approveAppointment = async (req, res) => {
  const { requestId } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Fetch the requested appointment
    const request = await RequestedAppointment.findById(requestId).session(session);
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    // Create a new Appointment document while retaining the original ID
    const confirmedAppointment = new Appointment({
      _id: request._id, // Retain the original ID
      caseId: request.caseId,
      patient: request.patient,
      doctor: request.doctor,
      hospital: request.hospital,
      department: request.department,
      type: request.type,
      tokenDate: request.tokenDate,
      status: 'Scheduled',
      note: request.note,
    });

    await confirmedAppointment.save({ session });

    // Update references in related entities
    await Promise.all([
      // Add reference to the hospital
      Hospital.findByIdAndUpdate(
        request.hospital,
        { $push: { appointments: confirmedAppointment._id } },
        { session }
      ),

      // Add reference to the department
      Department.findByIdAndUpdate(
        request.department,
        { $push: { appointments: confirmedAppointment._id } },
        { session }
      ),

      // Add reference to the patient
      Patient.findByIdAndUpdate(
        request.patient,
        { $push: { appointments: confirmedAppointment._id } },
        { session }
      ),

      // Add reference to the doctor
      Doctor.findByIdAndUpdate(
        request.doctor,
        { $push: { appointments: confirmedAppointment._id } },
        { session }
      ),
    ]);

    // Delete the original request
    await RequestedAppointment.findByIdAndDelete(requestId, { session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Appointment approved.', appointment: confirmedAppointment });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error('Error approving appointment:', error);
    res.status(500).json({ message: 'Failed to approve appointment.', error: error.message });
  }
};

export const rejectAppointment = async (req, res) => {
  const { requestId } = req.params;
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({ message: 'Unauthorized access. Hospital ID not found in session.' });
  }

  try {
    const request = await RequestedAppointment.findOne({ _id: requestId, hospital: hospitalId });
    if (!request) return res.status(404).json({ message: 'Request not found.' });

    const rejectedAppointment = new RejectedAppointment({
      hospital: hospitalId,
      caseId: request.caseId,
      patient: request.patient,
      doctor: request.doctor,
      tokenDate: request.tokenDate,
      department: request.department,
      status: 'Rejected',
    });

    await rejectedAppointment.save();

    // Push into hospital's RejectedAppointment array
    await Hospital.findByIdAndUpdate(hospitalId, {
      $push: { RejectedAppointment: rejectedAppointment._id }
    });

    // Push into department's rejectedAppointments array
    await Department.findByIdAndUpdate(request.department, {
      $push: { rejectedAppointments: rejectedAppointment._id }
    });

    // Remove from requested appointments
    await RequestedAppointment.findByIdAndDelete(requestId);

    res.status(201).json({ message: 'Appointment rejected.', rejectedAppointment });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject appointment.', error: error.message });
  }
};


export const cancelAppointment = async (req, res) => {
  const { appointmentId } = req.params;
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({ message: 'Unauthorized access. Hospital ID not found in session.' });
  }

  try {
    const appointment = await Appointment.findOne({ _id: appointmentId, hospital: hospitalId });
    if (!appointment) return res.status(404).json({ message: 'Appointment not found.' });

    const cancelledAppointment = new RejectedAppointment({
      hospital: hospitalId,
      caseId: appointment.caseId,
      patient: appointment.patient,
      doctor: appointment.doctor,
      tokenDate: appointment.tokenDate,
      department: appointment.department,
      status: 'Cancelled',
    });

    await cancelledAppointment.save();

    // Push into hospital's RejectedAppointment array
    await Hospital.findByIdAndUpdate(hospitalId, {
      $push: { RejectedAppointment: cancelledAppointment._id }
    });

    // Push into department's rejectedAppointments array
    await Department.findByIdAndUpdate(appointment.department, {
      $push: { rejectedAppointments: cancelledAppointment._id }
    });

    // Remove the original appointment
    await Appointment.findByIdAndDelete(appointmentId);

    res.status(201).json({ message: 'Appointment cancelled.', cancelledAppointment });
  } catch (error) {
    res.status(500).json({ message: 'Failed to cancel appointment.', error: error.message });
  }
};
