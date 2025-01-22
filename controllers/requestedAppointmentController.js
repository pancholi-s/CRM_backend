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
      caseId: request.caseId,
      patient: request.patient,
      doctor: request.doctor,
      hospital: hospitalId,
    });

    await rejectedAppointment.save();

    // Push the reference of the rejected appointment into the hospital's RejectedAppointment array
    await Hospital.findByIdAndUpdate(hospitalId, {
      $push: { RejectedAppointment: rejectedAppointment._id }
    });

    await RequestedAppointment.findByIdAndDelete(requestId);

    res.status(201).json({ message: 'Appointment rejected.', rejectedAppointment });
  } catch (error) {
    res.status(500).json({ message: 'Failed to reject appointment.' });
  }
};
