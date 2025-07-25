import Patient from "../models/patientModel.js";
import Appointment from "../models/appointmentModel.js";
import Bed from "../models/bedModel.js";
import Consultation from "../models/consultationModel.js";
import mongoose from "mongoose";

// Dashboard Overview Controller
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

    // Patient match conditions
    const patientMatchConditions = { hospital: hospitalId };
    if (departmentId) {
      patientMatchConditions.department = new mongoose.Types.ObjectId(String(departmentId));
    }

    // Add date filters to patient conditions if provided (based on registrationDate)
    if (fromDate || toDate) {
      patientMatchConditions.registrationDate = {};
      if (fromDate) patientMatchConditions.registrationDate.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        patientMatchConditions.registrationDate.$lte = end;
      }
    }

    // Consultation match conditions
    const consultationMatchConditions = {
      status: "scheduled"
    };
    if (departmentId) {
      consultationMatchConditions.department = new mongoose.Types.ObjectId(String(departmentId));
    }

    // Add date filters for consultations if provided
    if (fromDate || toDate) {
      consultationMatchConditions.date = {};
      if (fromDate) consultationMatchConditions.date.$gte = new Date(fromDate);
      if (toDate) {
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);
        consultationMatchConditions.date.$lte = end;
      }
    }

    // Add doctor filter if user is a doctor
    if (req.user?.role === "doctor" && req.user?._id) {
      consultationMatchConditions.doctor = new mongoose.Types.ObjectId(req.user._id);
    }

    // Count inpatients using the same logic as getInpatients()
    const [admittedPatients, followUpConsultations] = await Promise.all([
      Patient.find({
        ...patientMatchConditions,
        admissionStatus: "Admitted"
      }).select("_id").lean(),
      
      Consultation.find({
        followUpRequired: true
      })
      .populate({
        path: "patient",
        match: patientMatchConditions,
        select: "_id"
      })
      .select("patient")
      .lean()
    ]);

    // Get unique inpatient IDs (same logic as getInpatients)
    const inpatientSet = new Set();
    
    // Add admitted patients
    admittedPatients.forEach(patient => {
      inpatientSet.add(patient._id.toString());
    });
    
    // Add follow-up patients
    followUpConsultations
      .filter(consultation => consultation.patient)
      .forEach(consultation => {
        inpatientSet.add(consultation.patient._id.toString());
      });

    const totalInpatients = inpatientSet.size;

    // Get all required counts
    const [admitted, discharged, scheduled, opd] = await Promise.all([
      Patient.countDocuments({
        ...patientMatchConditions,
        admissionStatus: "Admitted",
      }),
      Patient.countDocuments({
        ...patientMatchConditions,
        admissionStatus: "Discharged",
      }),
      Consultation.countDocuments(consultationMatchConditions),
      Patient.countDocuments({
        ...patientMatchConditions,
        admissionStatus: { $ne: "Admitted" },
      }),
    ]);

    res.status(200).json({
      success: true,
      totalInpatients,
      totalOutpatients: opd,
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

// Inpatients List Controller
export const getInpatientsList = async (req, res) => {
  try {
    const { hospitalId } = req.session;
    const { departmentId } = req.query;

    if (!hospitalId) {
      return res.status(400).json({
        success: false,
        message: "Hospital context required",
      });
    }

    const matchConditions = {
      hospital: hospitalId,
      admissionStatus: "Admitted",
    };

    if (req.user?.role === "doctor" && req.user?._id) {
      matchConditions.doctors = req.user._id;
    }

    if (departmentId) {
      matchConditions.department = departmentId;
    }

    const patients = await Patient.find(matchConditions)
      .populate("doctors", "name")
      .populate("department", "name")
      .populate({
        path: "appointments",
        options: { sort: { tokenDate: -1 } },
        select: "tokenDate note type",
      });

    const formatted = await Promise.all(
      patients.map(async (patient) => {
        const recentAppt = patient.appointments?.[0];

        const bedInfo = await Bed.findOne({
          assignedPatient: patient._id,
        }).populate("room", "roomID name roomType");

        return {
          patientId: patient._id,
          patientName: patient.name || "Unknown",
          email: patient.email || "",
          doctorName: patient.doctors?.[0]?.name || "Unknown",
          department: patient.department?.name || "Unknown",
          status: patient.admissionStatus,
          condition: recentAppt?.note || "N/A",
          date: recentAppt?.tokenDate,
          visitType: recentAppt?.type || "Consultation",
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

// Appointed Patients Controller
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
        $in: ["Scheduled", "Completed", "Cancelled", "Ongoing", "Waiting"],
      },
    };

    if (req.user?.role === "doctor" && req.user?._id) {
      matchConditions.doctor = new mongoose.Types.ObjectId(req.user._id);
    }

    if (departmentId) {
      matchConditions.department = new mongoose.Types.ObjectId(
        String(departmentId)
      );
    }

    const [appointments, totalCount] = await Promise.all([
      Appointment.find(matchConditions)
        .populate({
          path: "patient",
          select: "name email phone admissionStatus",
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

    const ACTIVE_STATUSES = ["Scheduled", "Ongoing", "Waiting"];

    const formattedPatients = appointments.map((appt) => ({
      caseId: appt.caseId || "N/A",
      name: appt.patient?.name || "N/A",
      email: appt.patient?.email || "N/A",
      phone: appt.patient?.phone || "N/A",
      typeVisit: appt.typeVisit || "N/A",
      branch: appt.department?.name || "N/A",
      date: appt.tokenDate,
      booking: ACTIVE_STATUSES.includes(appt.status) ? "Active" : "In Active",
      realStatus: appt.status,
      admissionStatus: appt.patient?.admissionStatus || "Not Admitted",
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
