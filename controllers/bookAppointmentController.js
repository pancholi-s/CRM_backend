import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import Hospital from "../models/hospitalModel.js";
import Department from "../models/departmentModel.js";
import Doctor from "../models/doctorModel.js";
import Patient from "../models/patientModel.js";
import Appointment from "../models/appointmentModel.js";
import RejectedAppointment from "../models/rejectedAppointmentModel.js";
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
    gender,
    birthday,
    age,
    address,
    rescheduledFrom,
    procedureCategory, 
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

  // ✅ Prevent booking past appointments
  const appointmentDate = new Date(date);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (appointmentDate < today) {
    return res.status(400).json({ message: "Cannot book appointments for past dates." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    let patient = await Patient.findOne({ email, hospital: hospitalId });

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

    // 💡 Check if rescheduledFrom is provided and valid
    if (rescheduledFrom) {
      const oldAppointment = await Appointment.findById(rescheduledFrom);
      if (!oldAppointment) {
        return res.status(404).json({ message: "Old appointment not found." });
      }

      if (oldAppointment.status === "RescheduledOld") {
        return res.status(400).json({ message: "This appointment has already been rescheduled." });
      }
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
      rescheduledFrom: rescheduledFrom || null, // 👈 store reference
      procedureCategory: procedureCategory || null
    });

    if (typeVisit === "Walk in") {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);

      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      const lastAppointment = await Appointment.findOne({
        doctor: doctor._id,
        department: department._id,
        tokenDate: { $gte: startOfDay, $lte: endOfDay },
        tokenNumber: { $ne: null },
      }).sort({ tokenNumber: -1 });

      newAppointment.tokenNumber = lastAppointment ? lastAppointment.tokenNumber + 1 : 1;

    }

    await newAppointment.save({ session });

    // 👇 If it's a reschedule, update the old appointment's status and reference
    if (rescheduledFrom) {
      await Appointment.findByIdAndUpdate(rescheduledFrom, {
        status: "RescheduledOld",
        rescheduledTo: newAppointment._id,
      }, { session });
    }

    await Patient.findByIdAndUpdate(
      patient._id,
      {
        $push: { appointments: { _id: newAppointment._id } },
        $addToSet: { doctors: doctor._id },
      },
      { session, new: true }
    );

    await Doctor.findByIdAndUpdate(
      doctor._id,
      {
        $push: { appointments: newAppointment._id },
        $addToSet: { patients: patient._id },
      },
      { session, new: true }
    );

    await Hospital.findByIdAndUpdate(
      hospitalId,
      { $push: { appointments: newAppointment._id } },
      { session, new: true }
    );

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

    const populatedAppointment = await Appointment.findById(newAppointment._id)
      .populate("patient", "name email phone")
      .populate("doctor", "name specialization email")
      .populate("department", "name")
      .populate("hospital", "name address")
      .populate("rescheduledFrom", "caseId")
      .populate("rescheduledTo", "caseId");

    return res.status(201).json({
      message: rescheduledFrom
        ? "Appointment rescheduled successfully."
        : "Appointment booked successfully.",
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

    const weekdays = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

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

    const weeklyBreakdown = weekdays.map(name => ({
      name,
      total: 0,
      completed: 0,
      cancelled: 0,
      days: []
    }));

    const processAppointments = (appointments, status) => {
      appointments.forEach(({ tokenDate, department }) => {
        if (!tokenDate) return;

        const year = tokenDate.getFullYear();
        const month = tokenDate.getMonth();
        const dayKey = tokenDate.toISOString().slice(0, 10);
        const weekdayIndex = tokenDate.getDay();

        // Weekly (global)
        if (moment(tokenDate).isBetween(startOfWeek, endOfWeek, 'day', '[]')) {
          weeklyAppointments++;
          if (status === 'completed') weeklyCompleted++;
          if (status === 'cancelled') weeklyCancelled++;

          const day = weeklyBreakdown[weekdayIndex];
          day.total++;
          day[status]++;

          const existingDay = day.days.find(d => d.date === dayKey);
          if (existingDay) {
            existingDay.total++;
            existingDay[status]++;
          } else {
            day.days.push({
              date: dayKey,
              total: 1,
              completed: status === 'completed' ? 1 : 0,
              cancelled: status === 'cancelled' ? 1 : 0
            });
          }
        }

        // Yearly (global)
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

        // Department-wise
        if (!departmentWiseData[department]) {
          departmentWiseData[department] = {
            total: 0,
            completed: 0,
            cancelled: 0,
            weekly: {
              weeklyAppointments: 0,
              weeklyCompleted: 0,
              weeklyCancelled: 0,
              daily: weekdays.map(name => ({
                name,
                total: 0,
                completed: 0,
                cancelled: 0,
                days: []
              }))
            },
            yearly: {}
          };
        }

        const deptData = departmentWiseData[department];

        deptData.total++;
        deptData[status]++;

        // Weekly (department)
        if (moment(tokenDate).isBetween(startOfWeek, endOfWeek, 'day', '[]')) {
          deptData.weekly.weeklyAppointments++;
          if (status === 'completed') deptData.weekly.weeklyCompleted++;
          if (status === 'cancelled') deptData.weekly.weeklyCancelled++;

          const deptDay = deptData.weekly.daily[weekdayIndex];
          deptDay.total++;
          deptDay[status]++;

          const deptExistingDay = deptDay.days.find(d => d.date === dayKey);
          if (deptExistingDay) {
            deptExistingDay.total++;
            deptExistingDay[status]++;
          } else {
            deptDay.days.push({
              date: dayKey,
              total: 1,
              completed: status === 'completed' ? 1 : 0,
              cancelled: status === 'cancelled' ? 1 : 0
            });
          }
        }

        // Yearly (department)
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
        daily: weeklyBreakdown
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
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  try {
    const total = await RejectedAppointment.countDocuments({ hospital: hospitalId, status: 'Rejected' });
    const rejectedAppointments = await RejectedAppointment.find({ hospital: hospitalId, status: 'Rejected' })
      .populate('patient', 'name email phone')
      .populate('doctor', 'name email specialization')
      .sort({ dateActioned: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      message: "Rejected appointments retrieved successfully.",
      count: rejectedAppointments.length,
      totalRejected: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      rejectedAppointments,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching rejected appointments.",
      error: error.message,
    });
  }
};

export const getCancelledAppointments = async (req, res) => {
  const { hospitalId } = req.session;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  try {
    const total = await RejectedAppointment.countDocuments({ hospital: hospitalId, status: 'Cancelled' });
    const cancelledAppointments = await RejectedAppointment.find({ hospital: hospitalId, status: 'Cancelled' })
      .populate('patient', 'name email phone')
      .populate('doctor', 'name email specialization')
      .sort({ dateActioned: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      message: "Cancelled appointments retrieved successfully.",
      count: cancelledAppointments.length,
      totalCancelled: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      cancelledAppointments,
    });
  } catch (error) {
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
      if (!isDepartmentValid) {
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
        .populate("patient", "patId name email phone")
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
      .populate("patient","-password")
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

export const getAppointmentHistory = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Access denied. No hospital context found." });
    }

    const { page = 1, limit = 10, dateRange, status } = req.query;
    const skip = (page - 1) * limit;

    // Build filter object
    const filter = { hospital: hospitalId };

    // Date Range Filter
    if (dateRange) {
      let startDate;
      const today = moment().endOf("day");

      if (dateRange === "7") {
        // Last 7 days
        startDate = moment().subtract(7, "days").startOf("day");
      } else if (dateRange === "30") {
        // Last 30 days
        startDate = moment().subtract(30, "days").startOf("day");
      }

      if (startDate) {
        filter.tokenDate = { $gte: startDate.toDate(), $lte: today.toDate() };
      }
    }

    // Status Filter (allow multiple statuses)
    if (status) {
      const statusArray = status.split(",").map((st) => st.trim());
      filter.status = { $in: statusArray };
    }

    // Fetch appointments
    const appointments = await Appointment.find(filter)
      .populate("patient", "name phone")
      .populate("doctor", "phone")
      .sort({ tokenDate: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // Format for UI
    const formattedAppointments = appointments.map((appointment) => ({
      caseId: appointment.caseId,
      name: appointment.patient?.name || "N/A",
      phone: appointment.doctor?.phone || "N/A",
      typeVisit: appointment.typeVisit,
      token: appointment.tokenNumber || "N/A",
      date: moment(appointment.tokenDate).format("DD-MM-YYYY"),
      status: appointment.status,
    }));

    // Count for pagination
    const totalAppointments = await Appointment.countDocuments(filter);

    res.status(200).json({
      message: "Appointment history retrieved successfully",
      appointments: formattedAppointments,
      totalAppointments,
      totalPages: Math.ceil(totalAppointments / limit),
      currentPage: parseInt(page),
    });
  } catch (error) {
    console.error("Error fetching appointment history:", error);
    res.status(500).json({
      message: "Error fetching appointment history",
      error: error.message,
    });
  }
};

export const startAppointment = async (req, res) => {
  const { patientId } = req.body;
  const { hospitalId } = req.session;

  // Validate hospital context
  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  // Validate patientId
  if (!patientId) {
    return res.status(400).json({ message: "Patient ID is required." });
  }

  if (!mongoose.Types.ObjectId.isValid(patientId)) {
    return res.status(400).json({ message: "Invalid patient ID format." });
  }

  try {
    // Find the appointment with "Waiting" status for the given patient
    const appointment = await Appointment.findOne({
      patient: patientId,
      hospital: hospitalId,
      status: "Waiting"
    })
    .populate("patient", "name email phone")
    .populate("doctor", "name specialization email")
    .populate("department", "name")
    .populate("hospital", "name address");

    if (!appointment) {
      return res.status(404).json({ 
        message: "No waiting appointment found for this patient in the current hospital." 
      });
    }

    // Update the appointment status from "Waiting" to "Ongoing"
    appointment.status = "Ongoing";
    await appointment.save();

    res.status(200).json({
      message: "Appointment status updated to Ongoing successfully.",
      appointment: {
        _id: appointment._id,
        caseId: appointment.caseId,
        patient: appointment.patient,
        doctor: appointment.doctor,
        department: appointment.department,
        type: appointment.type,
        typeVisit: appointment.typeVisit,
        tokenDate: appointment.tokenDate,
        tokenNumber: appointment.tokenNumber,
        status: appointment.status,
        note: appointment.note
      }
    });

  } catch (error) {
    console.error("Error updating appointment status:", error);
    res.status(500).json({ 
      message: "Error updating appointment status.", 
      error: error.message 
    });
  }
};

// Send Patient to Last in Queue API - Reason is Optional
export const sendPatientToLast = async (req, res) => {
  const { appointmentId, reason } = req.body;
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  if (!appointmentId) {
    return res.status(400).json({ message: "Appointment ID is required." });
  }

  if (!mongoose.Types.ObjectId.isValid(appointmentId)) {
    return res.status(400).json({ message: "Invalid appointment ID." });
  }

  try {
    // Find the appointment that needs to be sent to last
    const appointment = await Appointment.findOne({
      _id: appointmentId,
      hospital: hospitalId,
      status: "Waiting" // Only waiting appointments can be moved
    }).populate("patient", "name email phone")
      .populate("doctor", "_id name")
      .populate("department", "_id name");

    if (!appointment) {
      return res.status(404).json({ 
        message: "Waiting appointment not found." 
      });
    }

    const today = new Date(appointment.tokenDate);
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const lastAppointment = await Appointment.findOne({
      doctor: appointment.doctor._id,
      department: appointment.department._id,
      hospital: hospitalId,
      tokenDate: { $gte: startOfDay, $lte: endOfDay },
      typeVisit: "Walk in",
      status: { $nin: ["Cancelled", "RescheduledOld", "Completed"] }
    }).sort({ tokenNumber: -1 });

    const newTokenNumber = lastAppointment ? lastAppointment.tokenNumber + 1 : 1;
    const oldTokenNumber = appointment.tokenNumber;

    const defaultReason = "Moved to end of queue";
    const actualReason = reason && reason.trim() ? reason.trim() : defaultReason;

    appointment.tokenNumber = newTokenNumber;
    appointment.note = appointment.note ? 
      `${appointment.note}\n[MOVED TO LAST] Reason: ${actualReason}` : 
      `[MOVED TO LAST] Reason: ${actualReason}`;
    
    await appointment.save();

    const currentQueue = await Appointment.find({
      doctor: appointment.doctor._id,
      department: appointment.department._id,
      hospital: hospitalId,
      tokenDate: { $gte: startOfDay, $lte: endOfDay },
      typeVisit: "Walk in",
      status: { $nin: ["Cancelled", "RescheduledOld", "Completed"] }
    })
    .populate("patient", "name")
    .sort({ tokenNumber: 1 })
    .select("tokenNumber patient status caseId");

    res.status(200).json({
      message: "Patient sent to last in queue successfully.",
      updatedAppointment: {
        _id: appointment._id,
        caseId: appointment.caseId,
        patient: appointment.patient,
        oldTokenNumber: oldTokenNumber,
        newTokenNumber: newTokenNumber,
        status: appointment.status,
        reasonProvided: reason ? true : false,
        actualReason: actualReason 
      },
      currentQueue: currentQueue.map(apt => ({
        tokenNumber: apt.tokenNumber,
        patientName: apt.patient.name,
        status: apt.status,
        caseId: apt.caseId
      })),
      queueSummary: {
        totalWaiting: currentQueue.filter(apt => apt.status === "Waiting").length,
        totalOngoing: currentQueue.filter(apt => apt.status === "Ongoing").length,
        nextPatient: currentQueue.find(apt => apt.status === "Waiting")?.patient.name || "None"
      }
    });

  } catch (error) {
    console.error("Error sending patient to last:", error);
    res.status(500).json({ 
      message: "Error moving patient to last in queue.", 
      error: error.message 
    });
  }
};

// Get Today's Queue Status (Helper API)
export const getTodayQueue = async (req, res) => {
  const { doctorId, departmentId } = req.query;
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  if (!doctorId || !departmentId) {
    return res.status(400).json({ message: "Doctor ID and Department ID are required." });
  }

  try {
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    const todayAppointments = await Appointment.find({
      doctor: doctorId,
      department: departmentId,
      hospital: hospitalId,
      tokenDate: { $gte: startOfDay, $lte: endOfDay },
      typeVisit: "Walk in",
      status: { $nin: ["Cancelled", "RescheduledOld", "Completed"] }
    })
    .populate("patient", "name phone")
    .sort({ tokenNumber: 1 })
    .select("tokenNumber patient status caseId tokenDate");

    const queueStatus = todayAppointments.map(apt => ({
      appointmentId: apt._id,
      tokenNumber: apt.tokenNumber,
      patientName: apt.patient.name,
      patientPhone: apt.patient.phone,
      status: apt.status,
      caseId: apt.caseId,
      time: apt.tokenDate
    }));

    const summary = {
      totalInQueue: todayAppointments.length,
      waiting: todayAppointments.filter(apt => apt.status === "Waiting").length,
      ongoing: todayAppointments.filter(apt => apt.status === "Ongoing").length,
      completed: todayAppointments.filter(apt => apt.status === "Completed").length,
      currentPatient: todayAppointments.find(apt => apt.status === "Ongoing")?.patient.name || "None",
      nextPatient: todayAppointments.find(apt => apt.status === "Waiting")?.patient.name || "None"
    };

    res.status(200).json({
      message: "Today's queue retrieved successfully.",
      date: today.toISOString().split('T')[0],
      summary: summary,
      queue: queueStatus
    });

  } catch (error) {
    console.error("Error fetching today's queue:", error);
    res.status(500).json({ 
      message: "Error fetching queue status.", 
      error: error.message 
    });
  }
};