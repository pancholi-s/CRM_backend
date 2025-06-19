import Appointment from "../models/appointmentModel.js";
import mongoose from "mongoose";

export const getMedicalProceduresStats = async (req, res) => {
  try {
    const { departmentId, month, year } = req.query;
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
      matchConditions.department = new mongoose.Types.ObjectId(
        String(departmentId)
      );
    }

    if (month && year) {
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0, 23, 59, 59);
      matchConditions.tokenDate = { $gte: startDate, $lte: endDate };
    }

    const [stats, totalCases] = await Promise.all([
      Appointment.aggregate([
        { $match: matchConditions },
        { $group: { _id: "$procedureCategory", count: { $sum: 1 } } },
        {
          $project: {
            _id: 0,
            procedureType: { $ifNull: ["$_id", "Unassigned"] },
            cases: "$count",
          },
        },
        { $sort: { cases: -1 } },
      ]),
      Appointment.countDocuments(matchConditions),
    ]);

    let percentageChange = 0;
    if (month && year) {
      const lastMonth = month - 1 === 0 ? 12 : month - 1;
      const lastYear = month - 1 === 0 ? year - 1 : year;
      const lastMonthStart = new Date(lastYear, lastMonth - 1, 1);
      const lastMonthEnd = new Date(lastYear, lastMonth, 0, 23, 59, 59);

      const lastMonthCount = await Appointment.countDocuments({
        ...matchConditions,
        tokenDate: { $gte: lastMonthStart, $lte: lastMonthEnd },
      });

      percentageChange =
        lastMonthCount > 0
          ? ((totalCases - lastMonthCount) / lastMonthCount) * 100
          : 100;
    }

    const topCategories = stats
      .filter((s) => s.procedureType !== "Unassigned")
      .slice(0, 4)
      .map((s) => s.procedureType);

    const breakdown = {};

    topCategories.forEach((cat) => {
      breakdown[cat] = stats.find((s) => s.procedureType === cat)?.cases || 0;
    });

    const unassigned = stats.find((s) => s.procedureType === "Unassigned");
    if (unassigned) {
      breakdown.Unassigned = unassigned.cases;
    }

    res.status(200).json({
      success: true,
      data: {
        totalCases,
        percentageChange: `${
          percentageChange > 0 ? "+" : ""
        }${percentageChange.toFixed(1)}%`,
        chartData: stats,
        breakdown,
        displayedCategories: topCategories, 
      },
    });
  } catch (error) {
    console.error("Medical procedures error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching statistics",
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