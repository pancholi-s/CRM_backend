import Appointment from "../models/appointmentModel.js";
import ProgressPhase from "../models/ProgressPhase.js";
import mongoose from "mongoose";

export const getMedicalProceduresStats = async (req, res) => {
  try {
    const { hospitalId } = req.session;
    const { filterType = "month", month, year } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "Hospital context required",
      });
    }

    const today = new Date();
    let startDate, endDate, prevStartDate, prevEndDate;

    if (filterType === "month") {
      const selectedMonth = month ? parseInt(month) - 1 : today.getMonth();
      const selectedYear = year ? parseInt(year) : today.getFullYear();

      startDate = new Date(selectedYear, selectedMonth, 1);
      endDate = new Date(selectedYear, selectedMonth + 1, 0, 23, 59, 59);

      const prevMonth = selectedMonth - 1;
      const prevYear = prevMonth < 0 ? selectedYear - 1 : selectedYear;
      const actualPrevMonth = (prevMonth + 12) % 12;

      prevStartDate = new Date(prevYear, actualPrevMonth, 1);
      prevEndDate = new Date(prevYear, actualPrevMonth + 1, 0, 23, 59, 59);
    } else if (filterType === "week") {
      const current = new Date();
      const first = current.getDate() - current.getDay() + 1;

      startDate = new Date(current.setDate(first));
      startDate.setHours(0, 0, 0, 0);

      endDate = new Date(startDate);
      endDate.setDate(endDate.getDate() + 6);
      endDate.setHours(23, 59, 59, 999);

      prevStartDate = new Date(startDate);
      prevStartDate.setDate(prevStartDate.getDate() - 7);
      prevStartDate.setHours(0, 0, 0, 0);

      prevEndDate = new Date(endDate);
      prevEndDate.setDate(prevEndDate.getDate() - 7);
      prevEndDate.setHours(23, 59, 59, 999);
    } else if (filterType === "year") {
      const selectedYear = year ? parseInt(year) : today.getFullYear();
      startDate = new Date(selectedYear, 0, 1);
      endDate = new Date(selectedYear, 11, 31, 23, 59, 59);

      prevStartDate = new Date(selectedYear - 1, 0, 1);
      prevEndDate = new Date(selectedYear - 1, 11, 31, 23, 59, 59);
    }

    const buildStatsPipeline = (dateRange) => ([
      { $match: { date: dateRange } },
      {
        $lookup: {
          from: "patients",
          localField: "patient",
          foreignField: "_id",
          as: "patientDetails",
        },
      },
      { $unwind: "$patientDetails" },
      {
        $match: {
          "patientDetails.hospital": new mongoose.Types.ObjectId(hospitalId),
        },
      },
      {
        $group: {
          _id: "$title",
          cases: { $sum: 1 },
        },
      },
      {
        $project: {
          _id: 0,
          procedureType: "$_id",
          cases: 1,
        },
      },
    ]);

    const stats = await ProgressPhase.aggregate(buildStatsPipeline({ $gte: startDate, $lte: endDate }));
    const prevStats = await ProgressPhase.aggregate(buildStatsPipeline({ $gte: prevStartDate, $lte: prevEndDate }));

    const totalCases = stats.reduce((sum, s) => sum + s.cases, 0);
    const prevTotalCases = prevStats.reduce((sum, s) => sum + s.cases, 0);

    const percentageChange =
      prevTotalCases === 0
        ? null
        : +(((totalCases - prevTotalCases) / prevTotalCases) * 100).toFixed(2);

    const breakdown = Object.fromEntries(stats.map((s) => [s.procedureType, s.cases]));

    res.status(200).json({
      success: true,
      data: {
        totalCases,
        percentageChange,
        breakdown,
        displayedCategories: Object.keys(breakdown).slice(0, 4),
      },
    });
  } catch (error) {
    console.error("ProgressPhase stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching stats",
    });
  }
};

export const getHeaderStats = async (req, res) => {
  try {
    const { departmentId } = req.query;
    const { hospitalId } = req.session;

    if (!hospitalId) {
      return res
        .status(400)
        .json({ success: false, message: "Hospital context required" });
    }

    const matchConditions = {
      hospital: new mongoose.Types.ObjectId(String(hospitalId)),
      status: { $in: ["Scheduled", "Completed"] },
    };

    if (departmentId) {
      matchConditions.department = new mongoose.Types.ObjectId(String(departmentId));
    }

    const stats = await Appointment.aggregate([
      { $match: matchConditions },
      { $group: { _id: "$procedureCategory", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const totalPatients = await Appointment.countDocuments(matchConditions);

    const headerDisplay = {
      "Total Patients": totalPatients,
    };

    const result = {
      totalPatients,
    };

    stats.forEach(({ _id, count }) => {
      const label = _id || "Unassigned";
      const key = `total${label.replace(/\s/g, "")}`;
      headerDisplay[`Total ${label}`] = count;
      result[key] = count;
    });

    res.status(200).json({
      success: true,
      data: {
        ...result,
        headerDisplay,
        topCategories: stats.map(s => s._id || "Unassigned").slice(0, 4),
      },
    });
  } catch (error) {
    console.error("Header stats error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching header stats",
    });
  }
};

export const getPatientsByCategory = async (req, res) => {
  try {
    const { category } = req.params;
    const { departmentId, page = 1, limit = 10 } = req.query;
    const { hospitalId } = req.session;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "Hospital context required",
      });
    }

    const matchConditions = {
      hospital: new mongoose.Types.ObjectId(String(hospitalId)),
      status: { $in: ["Scheduled", "Completed", "Cancelled"] }, 
    };

    if (category === "Unassigned") {
      matchConditions.procedureCategory = { $in: [null, undefined] };
    } else {
      matchConditions.procedureCategory = category;
    }

    if (departmentId) {
      matchConditions.department = new mongoose.Types.ObjectId(String(departmentId));
    }

    const [appointments, totalCount] = await Promise.all([
      Appointment.find(matchConditions)
        .populate({
          path: "patient",
          select: "name email",
        })
        .populate({
          path: "doctor",
          select: "name",
        })
        .select("patient doctor tokenDate procedureCategory status caseId")
        .sort({ tokenDate: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Appointment.countDocuments(matchConditions),
    ]);

    // Format response for frontend
    const formattedPatients = appointments.map((appt) => ({
      caseId: appt.caseId,
      name: appt.patient?.name || "N/A",
      email: appt.patient?.email || "N/A",
      date: appt.tokenDate,
      surgeryType: appt.procedureCategory || "Unassigned",
      doctor: appt.doctor?.name || "N/A",
      status: appt.status,
    }));

    res.status(200).json({
      success: true,
      data: {
        totalCount,
        patients: formattedPatients,
        pagination: {
          currentPage: parseInt(page),
          totalPages: Math.ceil(totalCount / limit),
          hasNext: page < Math.ceil(totalCount / limit),
          hasPrev: page > 1,
        },
      },
    });
  } catch (error) {
    console.error("Patients by category error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching patients",
    });
  }
};