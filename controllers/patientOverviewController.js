import Appointment from "../models/appointmentModel.js";
import Bed from "../models/bedModel.js";
import mongoose from "mongoose";

export const getPatientOverview = async (req, res) => {
  try {
    const { hospitalId } = req.session;
    const { departmentId, fromDate, toDate } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "Hospital context required",
      });
    }

    const matchConditions = {
      hospital: new mongoose.Types.ObjectId(String(hospitalId)),
    };

    if (departmentId) {
      matchConditions.department = new mongoose.Types.ObjectId(
        String(departmentId)
      );
    }

    if (fromDate || toDate) {
      matchConditions.tokenDate = {};
      if (fromDate) {
        matchConditions.tokenDate.$gte = new Date(fromDate);
      }
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        matchConditions.tokenDate.$lte = end;
      }
    }

    const [admitted, discharged, scheduled, opd, totalCases] =
      await Promise.all([
        Appointment.countDocuments({ ...matchConditions, status: "Admitted" }),
        Appointment.countDocuments({
          ...matchConditions,
          status: "Discharged",
        }),
        Appointment.countDocuments({ ...matchConditions, status: "Scheduled" }),
        Appointment.countDocuments({
          ...matchConditions,
          status: { $in: ["Completed", "Ongoing"] },
        }),
        Appointment.countDocuments({ ...matchConditions }),
      ]);

    const totalInpatients = admitted;
    const totalOutpatients = opd;

    res.status(200).json({
      success: true,
      filtersApplied: {
        departmentId,
        fromDate,
        toDate,
      },
      totalCases,
      totalInpatients,
      totalOutpatients,
      overview: {
        admitted,
        discharged,
        scheduled,
        opd,
      },
    });
  } catch (error) {
    console.error("Dashboard Overview Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load patient overview",
    });
  }
};

export const getInpatientsList = async (req, res) => {
  try {
    const { hospitalId } = req.session;
    const { departmentId, fromDate, toDate } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "Hospital context required",
      });
    }

    const matchConditions = {
      hospital: new mongoose.Types.ObjectId(String(hospitalId)),
      status: "Admitted",
    };

    if (departmentId) {
      matchConditions.department = new mongoose.Types.ObjectId(
        String(departmentId)
      );
    }

    if (fromDate || toDate) {
      matchConditions.tokenDate = {};
      if (fromDate) matchConditions.tokenDate.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        matchConditions.tokenDate.$lte = end;
      }
    }

    const patients = await Appointment.find(matchConditions)
      .populate("patient", "name email")
      .populate("doctor", "name")
      .populate("department", "name")
      .select("patient doctor tokenDate department status note type");

    const formatted = await Promise.all(
      patients.map(async (appt) => {
        let bedInfo = await Bed.findOne({
          assignedPatient: appt.patient?._id,
        }).populate("room", "roomID name roomType");

        return {
          patientId: appt.patient?._id,
          patientName: appt.patient?.name || "Unknown",
          email: appt.patient?.email || "",
          doctorName: appt.doctor?.name || "Unknown",
          department: appt.department?.name || "Unknown",
          status: appt.status,
          condition: appt.note || "N/A",
          date: appt.tokenDate,
          visitType: appt.type || "Consultation",
          bedNumber: bedInfo?.bedNumber || "Not Assigned",
          bedType: bedInfo?.bedType || null,
          roomID: bedInfo?.room?.roomID || "Not Assigned",
          roomName: bedInfo?.room?.name || "Not Assigned",
          roomType: bedInfo?.room?.roomType || null,
        };
      })
    );

    res.status(200).json({
      success: true,
      total: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("Inpatient List Error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to load inpatient list",
    });
  }
};

export const getAllAppointedPatients = async (req, res) => {
  try {
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
      status: {
        $in: ["Admitted", "Discharged", "Scheduled", "Completed", "Cancelled"],
      },
    };

    if (departmentId) {
      matchConditions.department = new mongoose.Types.ObjectId(
        String(departmentId)
      );
    }

    const [appointments, totalCount] = await Promise.all([
      Appointment.find(matchConditions)
        .populate({
          path: "patient",
          select: "name email phone",
        })
        .populate({
          path: "doctor",
          select: "name",
        })
        .populate({
          path: "department",
          select: "name",
        })
        .select(
          "patient doctor department tokenDate procedureCategory status caseId typeVisit"
        )
        .sort({ tokenDate: -1 })
        .skip((page - 1) * limit)
        .limit(parseInt(limit)),
      Appointment.countDocuments(matchConditions),
    ]);

    const formattedPatients = appointments.map((appt) => ({
      caseId: appt.caseId || "N/A",
      name: appt.patient?.name || "N/A",
      email: appt.patient?.email || "N/A",
      phone: appt.patient?.phone || "N/A",
      typeVisit: appt.typeVisit || "N/A",
      branch: appt.department?.name || "N/A",
      date: appt.tokenDate,
      booking: appt.status,
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
    console.error("All appointed patients error:", error);
    res.status(500).json({
      success: false,
      message: "Error fetching appointed patients",
    });
  }
};
