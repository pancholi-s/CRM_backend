import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import Hospital from "../models/hospitalModel.js";
import Department from "../models/departmentModel.js";
import Doctor from "../models/doctorModel.js";
import Patient from "../models/patientModel.js";
import Appointment from "../models/appointmentModel.js";
import RejectedAppointment from '../models/rejectedAppointmentModel.js';

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
    typeVisit,
    
    gender,       //optional
    birthday,
    age,
    address,
  } = req.body;

  const { hospitalId } = req.session;
  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  if (!patientName || !appointmentType || !typeVisit || !departmentName || !doctorEmail || !mobileNumber || !email || !date) {
    return res.status(400).json({ message: "All required fields must be provided." });
  }

  if (!["Walk in", "Referral", "Online"].includes(typeVisit)) {
    return res.status(400).json({ message: "Invalid typeVisit. Use 'Walk in', 'Referral', or 'Online'." });
  }

  //to avoid differences in the last digit of object id stored as references in patient  
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let patient = await Patient.findOne({ email, hospital: hospitalId });

    // If patient does not exist, create a new one
    if (!patient) {
      const defaultPassword = "changeme";
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      patient = new Patient({
        name: patientName,
        gender: gender || "Not specified",
        birthday: birthday || "Not specified",
        age: age || 0,
        address: address || "Not specified",
        email,
        password: hashedPassword,
        phone: mobileNumber,
        hospital: hospitalId,
        status: "active",
        registrationDate: new Date(),
      });

      await patient.save({ session });
    }

    // Validate doctor
    const doctor = await Doctor.findOne({ email: doctorEmail, hospital: hospitalId }).populate("departments");
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found in this hospital." });
    }

    // Validate department within hospital
    const department = await Department.findOne({ name: departmentName, hospital: hospitalId });
    if (!department) {
      return res.status(404).json({ message: "Department not found in this hospital." });
    }

    // Ensure doctor belongs to the department
    const doctorInDepartment = doctor.departments.some((dept) => dept.equals(department._id));
    if (!doctorInDepartment) {
      return res.status(400).json({ message: "Doctor is not assigned to the specified department." });
    }

    const newAppointment = new Appointment({
      patient: patient._id,
      doctor: doctor._id,
      type: appointmentType,
      typeVisit,
      department: department._id,
      tokenDate: date,
      status: status || "Scheduled",
      note,
      hospital: hospitalId,
    });

    // If typeVisit is "Walk in", assign token number **before saving**
    if (typeVisit === "Walk in") {
      const todayStart = new Date();
      todayStart.setHours(0, 0, 0, 0);
      const todayEnd = new Date();
      todayEnd.setHours(23, 59, 59, 999);

      const lastAppointment = await Appointment.findOne({
        doctor: doctor._id,
        department: department._id,
        tokenDate: { $gte: todayStart, $lte: todayEnd },
        tokenNumber: { $ne: null },
      })
        .sort({ tokenNumber: -1 }) // Get the highest token number assigned today
        .select("tokenNumber");

      newAppointment.tokenNumber = lastAppointment ? lastAppointment.tokenNumber + 1 : 1;
    }

    await newAppointment.save({ session });

    // Update patient's appointments array
    const updatedPatient = await Patient.findByIdAndUpdate(
      patient._id,
      {
        $push: { appointments: { _id: newAppointment._id } },
        $addToSet: { doctors: doctor._id }, // Add doctor ID only if not already present
      },
      { session, new: true }
    );

    // Update doctor's appointments and patients arrays
    await Doctor.findByIdAndUpdate(
      doctor._id,
      {
        $push: { appointments: newAppointment._id },
        $addToSet: { patients: patient._id },
      },
      { session, new: true }
    );

    // Update the hospital's appointments array
    await Hospital.findByIdAndUpdate(
      hospitalId,
      { $push: { appointments: newAppointment._id } },
      { session, new: true }
    );

    // Update the department's appointments and patients arrays
    await Department.findByIdAndUpdate(
      department._id,
      { $push: { appointments: newAppointment._id }, $addToSet: { patients: patient._id } },
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
    // Get all appointment dates for the hospital
    const completedAppointments = await Appointment.find({ hospital: hospitalId, status: 'Completed' }).select('tokenDate');
    const cancelledAppointments = await RejectedAppointment.find({ hospital: hospitalId, status: 'Cancelled' }).select('tokenDate');

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const yearlyData = {};
    let totalAppointments = 0;
    let totalCompleted = 0;
    let totalCancelled = 0;

    const processAppointments = (appointments, status) => {
      appointments.forEach(({ tokenDate }) => {
        if (!tokenDate) return;

        const year = tokenDate.getFullYear();
        const month = tokenDate.getMonth(); // 0-based index

        if (!yearlyData[year]) {
          yearlyData[year] = {
            total: 0,
            completed: 0,
            cancelled: 0,
            months: Array(12).fill(null).map((_, i) => ({
              name: monthNames[i],
              total: 0,
              completed: 0,
              cancelled: 0,
            })),
          };
        }

        yearlyData[year].total++;
        yearlyData[year][status]++;

        yearlyData[year].months[month].total++;
        yearlyData[year].months[month][status]++;

        // Aggregate totals for all years
        totalAppointments++;
        if (status === 'completed') totalCompleted++;
        if (status === 'cancelled') totalCancelled++;
      });
    };

    processAppointments(completedAppointments, 'completed');
    processAppointments(cancelledAppointments, 'cancelled');

    res.status(200).json({
      Total: {
        totalAppointments,
        totalCompleted,
        totalCancelled,
      },
      yearlyData,
    });
  } catch (error) {
    res.status(500).json({ message: 'Failed to get appointment counts.', error: error.message });
  }
};

export const getRejectedAppointments = async (req, res) => {
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  try {
    const rejectedAppointments = await RejectedAppointment.find({ hospital: hospitalId, status: 'Rejected' })
      .populate('patient', 'name email phone')
      .populate('doctor', 'name email specialization')
      .sort({ dateActioned: -1 });

    res.status(200).json({
      message: "Rejected appointments retrieved successfully.",
      count: rejectedAppointments.length,
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

export const getCancelledAppointments = async (req, res) => {
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  try {
    const cancelledAppointments = await RejectedAppointment.find({ hospital: hospitalId, status: 'Cancelled' })
      .populate('patient', 'name email phone')
      .populate('doctor', 'name email specialization')
      .sort({ dateActioned: -1 });

    res.status(200).json({
      message: "Cancelled appointments retrieved successfully.",
      count: cancelledAppointments.length,
      cancelledAppointments,
    });
  } catch (error) {
    console.error('Error fetching cancelled appointments:', error);
    res.status(500).json({
      message: "Error fetching cancelled appointments.",
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
