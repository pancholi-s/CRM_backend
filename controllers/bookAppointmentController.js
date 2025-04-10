import mongoose from "mongoose";
import bcrypt from "bcryptjs";

import Hospital from "../models/hospitalModel.js";
import Department from "../models/departmentModel.js";
import Doctor from "../models/doctorModel.js";
import Patient from "../models/patientModel.js";
import Appointment from "../models/appointmentModel.js";
import RejectedAppointment from '../models/rejectedAppointmentModel.js';
import moment from "moment";

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

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let patient = await Patient.findOne({ email, hospital: hospitalId });

    // If patient does not exist, create a new one
    if (!patient) {
      const defaultPassword = "changeme123";
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
        typeVisit: "Walk in",
        registrationDate: new Date(),
      });

      await patient.save({ session });
    }

    const doctor = await Doctor.findOne({ email: doctorEmail, hospital: hospitalId }).populate("departments");
    if (!doctor) {
      return res.status(404).json({ message: "Doctor not found in this hospital." });
    }

    const department = await Department.findOne({ name: departmentName, hospital: hospitalId });
    if (!department) {
      return res.status(404).json({ message: "Department not found in this hospital." });
    }

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
    await Patient.findByIdAndUpdate(
      patient._id,
      {
        $push: { appointments: { _id: newAppointment._id } },
        $addToSet: { doctors: doctor._id },
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
      {
        $push: { appointments: newAppointment._id },
        $addToSet: { patients: patient._id },
      },
      { session, new: true }
    );

    await session.commitTransaction();
    session.endSession();

    // Populate appointment data
    const populatedAppointment = await Appointment.findById(newAppointment._id)
      .populate("patient", "name email phone")
      .populate("doctor", "name specialization email")
      .populate("department", "name")
      .populate("hospital", "name address");

    return res.status(201).json({
      message: "Appointment booked successfully.",
      appointment: populatedAppointment,
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

//added date wise filtering
export const getAppointmentsByStatus = async (req, res) => {
  const { status, date } = req.query;
  const { page = 1, limit = 10 } = req.query; // Get pagination from request
  const skip = (page - 1) * limit; // Calculate how many records to skip

  try {
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context not found in session." });
    }

    let filter = { hospital: hospitalId };

    if (status) {
      filter.status = status;
    } else {
      return res.status(400).json({ message: "Status query parameter is required." });
    }

    // If date is provided, filter appointments for that specific day
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filter.tokenDate = { $gte: startOfDay, $lte: endOfDay };
    }

    let appointments;

    // Fetch all appointments regardless of status
    if (status === "Scheduled") {
      appointments = await Appointment.find()
        .populate("patient", "name email")
        .populate("doctor", "name email")
        .populate("department", "name")
        .populate("hospital", "name address")
        .skip(skip)
        .limit(limit);
    } else {
      // Filter by the provided status and hospitalId
      appointments = await Appointment.find(filter)
        .populate("patient", "name email")
        .populate("doctor", "name email")
        .populate("department", "name")
        .populate("hospital", "name address")
        .skip(skip)
        .limit(limit);
    }

    // Fetch total count for pagination metadata
    const totalAppointments = await Appointment.countDocuments(filter);
    const totalPages = Math.ceil(totalAppointments / limit);


    res.status(200).json({
      message: `${status || "All"} appointments retrieved successfully`,
      totalAppointments,
      totalPages,
      currentPage: page,
      appointments,
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Error fetching appointments" });
  }
};

//added date wise filtering
export const getFilteredAppointments = async (req, res) => {
  const { departmentId, status, date, page = 1, limit = 10 } = req.query; // Default page=1, limit=10

  try {
    // Retrieve hospitalId from the session
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context not found in session." });
    }

    // Validate departmentId
    if (!mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({ message: "Invalid department ID." });
    }

    const departmentObjectId = new mongoose.Types.ObjectId(departmentId);

    // Check if the department belongs to the hospital
    const hospital = await Hospital.findById(hospitalId).populate("departments");
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found." });
    }

    const isDepartmentValid = hospital.departments.some(
      (dep) => dep._id.toString() === departmentObjectId.toString()
    );
    if (!isDepartmentValid) {
      return res.status(404).json({ message: "Department does not belong to the specified hospital." });
    }

    // Prepare the filter object
    const filter = {
      department: departmentObjectId,
      hospital: hospitalId,
    };

    // If status is not "Scheduled", apply the status filter
    if (status !== "Scheduled") {
      const validStatuses = Appointment.schema.path("status").enumValues;
      if (!status || !validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid or missing appointment status." });
      }
      filter.status = status;
    }

    // If date is provided, filter appointments for that specific day
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filter.tokenDate = { $gte: startOfDay, $lte: endOfDay };
    }

    // Convert page and limit to numbers for pagination
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Fetch filtered and paginated appointments
    const appointments = await Appointment.find(filter)
      .populate("patient", "name email")
      .populate("doctor", "name email")
      .populate("department", "name")
      .populate("hospital", "name address")
      .skip(skip)
      .limit(limitNumber);

    // Total count of filtered appointments
    const totalAppointments = await Appointment.countDocuments(filter);

    res.status(200).json({
      message: `${status || "All"} appointments retrieved successfully`,
      count: appointments.length,
      total: totalAppointments, // Total count before pagination
      totalPages: Math.ceil(totalAppointments / limitNumber), // Total pages available
      currentPage: pageNumber,
      appointments,
    });
  } catch (error) {
    console.error("Error fetching filtered appointments:", error);
    res.status(500).json({ message: "Error fetching filtered appointments" });
  }
};

export const getAppointmentCounts = async (req, res) => {
  const { hospitalId } = req.session;
  const { department } = req.query;

  if (!hospitalId) {
    return res.status(403).json({ message: 'Unauthorized access. Hospital ID not found in session.' });
  }

  try {
    const baseFilter = { hospital: hospitalId };
    if (department) {
      if (mongoose.Types.ObjectId.isValid(department)) {
        baseFilter.department = new mongoose.Types.ObjectId(department);
      } else {
        return res.status(400).json({ message: 'Invalid department ID.' });
      }
    }
    
    const completedAppointments = await Appointment.find({ ...baseFilter, status: 'Completed' }).select('tokenDate department');
    const cancelledAppointments = await RejectedAppointment.find({ ...baseFilter, status: 'Cancelled' }).select('tokenDate department');

    const monthNames = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];

    const yearlyData = {};
    const departmentWiseData = {};

    let totalAppointments = 0;
    let totalCompleted = 0;
    let totalCancelled = 0;

    const startOfWeek = moment().startOf('isoWeek');
    const endOfWeek = moment().endOf('isoWeek');
    let weeklyAppointments = 0;
    let weeklyCompleted = 0;
    let weeklyCancelled = 0;

    const processAppointments = (appointments, status) => {
      appointments.forEach(({ tokenDate, department }) => {
        if (!tokenDate) return;

        const year = tokenDate.getFullYear();
        const month = tokenDate.getMonth();
        const dayKey = tokenDate.toISOString().slice(0, 10);

        // Weekly
        if (moment(tokenDate).isBetween(startOfWeek, endOfWeek, 'day', '[]')) {
          weeklyAppointments++;
          if (status === 'completed') weeklyCompleted++;
          if (status === 'cancelled') weeklyCancelled++;
        }

        // Yearly breakdown
        if (!yearlyData[year]) {
          yearlyData[year] = {
            total: 0,
            completed: 0,
            cancelled: 0,
            months: Array.from({ length: 12 }, (_, i) => ({
              name: monthNames[i],
              total: 0,
              completed: 0,
              cancelled: 0,
              days: [],
            })),
          };
        }

        yearlyData[year].total++;
        yearlyData[year][status]++;

        const monthObj = yearlyData[year].months[month];
        monthObj.total++;
        monthObj[status]++;

        const existingDay = monthObj.days.find(d => d.date === dayKey);
        if (existingDay) {
          existingDay.total++;
          existingDay[status]++;
        } else {
          monthObj.days.push({
            date: dayKey,
            total: 1,
            completed: status === 'completed' ? 1 : 0,
            cancelled: status === 'cancelled' ? 1 : 0
          });
        }

        totalAppointments++;
        if (status === 'completed') totalCompleted++;
        if (status === 'cancelled') totalCancelled++;

        // Department-wise breakdown
        if (!departmentWiseData[department]) {
          departmentWiseData[department] = {
            total: 0,
            completed: 0,
            cancelled: 0,
            weekly: {
              weeklyAppointments: 0,
              weeklyCompleted: 0,
              weeklyCancelled: 0
            },
            yearly: {}
          };
        }

        const deptData = departmentWiseData[department];

        deptData.total++;
        deptData[status]++;

        if (moment(tokenDate).isBetween(startOfWeek, endOfWeek, 'day', '[]')) {
          deptData.weekly.weeklyAppointments++;
          if (status === 'completed') deptData.weekly.weeklyCompleted++;
          if (status === 'cancelled') deptData.weekly.weeklyCancelled++;
        }

        if (!deptData.yearly[year]) {
          deptData.yearly[year] = {
            total: 0,
            completed: 0,
            cancelled: 0,
            months: Array.from({ length: 12 }, (_, i) => ({
              name: monthNames[i],
              total: 0,
              completed: 0,
              cancelled: 0,
            }))
          };
        }

        deptData.yearly[year].total++;
        deptData.yearly[year][status]++;
        deptData.yearly[year].months[month].total++;
        deptData.yearly[year].months[month][status]++;
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
      Weekly: {
        startOfWeek: startOfWeek.format("YYYY-MM-DD"),
        endOfWeek: endOfWeek.format("YYYY-MM-DD"),
        weeklyAppointments,
        weeklyCompleted,
        weeklyCancelled,
      },
      yearlyData,
      departmentWiseData,
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

//added date wise filtering
export const getAppointmentsByVisitType = async (req, res) => {
  try {
    const { typeVisit, date, page = 1, limit = 10 } = req.query;
    const hospitalId = req.session.hospitalId;

    // Validate typeVisit
    const validVisitTypes = ["Walk in", "Referral", "Online"];
    if (!typeVisit || !validVisitTypes.includes(typeVisit)) {
      return res.status(400).json({
        message: "Invalid visit type. Use 'Walk in', 'Referral', or 'Online'.",
      });
    }

    if (!hospitalId) {
      return res.status(403).json({ message: "Access denied. No hospital context found." });
    }

    let filter = { typeVisit, hospital: hospitalId };

    // If date is provided, filter appointments for that specific day
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      filter.tokenDate = { $gte: startOfDay, $lte: endOfDay };
    }

    // Convert page and limit to numbers for pagination
    const pageNumber = parseInt(page, 10);
    const limitNumber = parseInt(limit, 10);
    const skip = (pageNumber - 1) * limitNumber;

    // Fetch paginated appointments
    const appointments = await Appointment.find(filter)
      .populate("patient", "name email phone")
      .populate("doctor", "name specialization")
      .populate("department", "name")
      .select("-__v")
      .skip(skip)
      .limit(limitNumber);

    // Get total count of filtered appointments
    const totalAppointments = await Appointment.countDocuments(filter);

    res.status(200).json({
      hospitalId,
      typeVisit,
      count: appointments.length,
      total: totalAppointments, // Total count before pagination
      totalPages: Math.ceil(totalAppointments / limitNumber), // Total pages available
      currentPage: pageNumber,
      appointments,
    });
  } catch (error) {
    console.error("Error fetching appointments by visit type:", error);
    res.status(500).json({
      message: "Failed to fetch appointments.",
      error: error.message,
    });
  }
};

export const getAppointments = async (req, res) => {
  const {
    start,
    end,
    status,
    departmentId,
    typeVisit,
    page = 1,
    limit = 10,
  } = req.query;

  const skip = (parseInt(page, 10) - 1) * parseInt(limit, 10);

  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context found." });
    }

    if (!start || !end) {
      return res.status(400).json({ message: "Start and end datetime are required." });
    }

    const startDate = new Date(start);
    const endDate = new Date(end);
    if (isNaN(startDate) || isNaN(endDate)) {
      return res.status(400).json({ message: "Invalid datetime format." });
    }

    if (departmentId && !mongoose.Types.ObjectId.isValid(departmentId)) {
      return res.status(400).json({ message: "Invalid department ID." });
    }

    const filter = {
      hospital: hospitalId,
      tokenDate: { $gte: startDate, $lte: endDate },
    };

    // Apply department filter early, for both Rejected and normal appointments
    if (departmentId) {
      if (!mongoose.Types.ObjectId.isValid(departmentId)) {
        return res.status(400).json({ message: "Invalid department ID." });
      }

      const hospital = await Hospital.findById(hospitalId).populate("departments");
      if (!hospital) {
        return res.status(404).json({ message: "Hospital not found." });
      }

      const isDepartmentValid = hospital?.departments.some(
        (dep) => dep._id.toString() === departmentId
      );
      if (!isValid) {
        return res.status(404).json({ message: "Department not found in this hospital." });
      }
      filter.department = departmentId;
    }

    if (typeVisit) {
      const validTypes = ["Walk in", "Referral", "Online"];
      if (!validTypes.includes(typeVisit)) {
        return res.status(400).json({ message: "Invalid typeVisit" });
      }
      filter.typeVisit = typeVisit;
    }

    const effectiveStatus = status || "Scheduled";

    // Handle Rejected/Cancelled
    if (["Rejected", "Cancelled"].includes(effectiveStatus)) {
      filter.status = effectiveStatus;

      const total = await RejectedAppointment.countDocuments(filter);
      const appointments = await RejectedAppointment.find(filter)
        .populate("patient", "name email phone")
        .populate("doctor", "name specialization email")
        .populate("department", "name")
        .populate("hospital", "name address")
        .sort({ tokenDate: -1 })
        .skip(skip)
        .limit(parseInt(limit));

      return res.status(200).json({
        message: `${effectiveStatus} appointments retrieved successfully`,
        filtersApplied: {
          start,
          end,
          status: effectiveStatus,
          departmentId,
          typeVisit,
        },
        count: appointments.length,
        totalAppointments: total,
        totalPages: Math.ceil(total / limit),
        currentPage: parseInt(page, 10),
        appointments,
      });
    }

    // Handle Scheduled/Completed/Other statuses
    if (status && status !== "Scheduled") {
      const validStatuses = Appointment.schema.path("status").enumValues;
      if (!validStatuses.includes(status)) {
        return res.status(400).json({ message: "Invalid status provided." });
      }
      filter.status = status;
    }

    const total = await Appointment.countDocuments(filter);
    const appointments = await Appointment.find(filter)
      .populate("patient", "name email phone")
      .populate("doctor", "name specialization email")
      .populate("department", "name")
      .populate("hospital", "name address")
      .sort({ tokenDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    return res.status(200).json({
      message: `${status || "Scheduled"} appointments retrieved successfully`,
      filtersApplied: {
        start,
        end,
        status: status || "Scheduled",
        departmentId,
        typeVisit,
      },
      count: appointments.length,
      totalAppointments: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page, 10),
      appointments,
    });
  } catch (error) {
    console.error("Error fetching appointments:", error);
    res.status(500).json({ message: "Error fetching appointments", error: error.message });
  }
};

//add "edit appointment" functionality
