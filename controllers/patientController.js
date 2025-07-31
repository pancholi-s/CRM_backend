import Patient from "../models/patientModel.js";
import Bill from "../models/billModel.js";
import Consultation from "../models/consultationModel.js";
import Appointment from "../models/appointmentModel.js";
import Bed from "../models/bedModel.js";
import ProgressPhase from "../models/ProgressPhase.js";
import Progress from "../models/progressLog.js";
import moment from "moment";
// Get Patients by Hospital with Sorting
export const getPatientsByHospital = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital ID is required" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sortOrder = req.query.sort === "asc" ? 1 : -1; // Default: Newest first (desc)

    // Fetch total count of patients
    const totalPatients = await Patient.countDocuments({
      hospital: hospitalId,
    });

    // Fetch and sort patients before pagination
    const patients = await Patient.find({ hospital: hospitalId })
      .select("-password") // Exclude password field
      .populate({
        path: "appointments",
        populate: [
          { path: "doctor", select: "name _id" },
          { path: "department", select: "name" },
        ],
      })
      .populate({ path: "doctors", select: "name _id" }) // Populate the doctors array
      .sort({ registrationDate: sortOrder }) // ✅ Sort patients before pagination
      .skip(skip)
      .limit(limit);

    if (!patients || patients.length === 0) {
      return res
        .status(404)
        .json({ message: "No patients found for this hospital" });
    }

    console.log("Fetched Patients:", JSON.stringify(patients, null, 2));

    // Process patient data and fetch corresponding bills
    const patientData = await Promise.all(
      patients.map(async (patient) => {
        const consultations = await Consultation.find({ patient: patient._id })
          .populate("doctor", "name")
          .populate("department", "name")
          .populate("appointment", "caseId tokenDate status")
          .lean();

        const bills = await Bill.find({ patient: patient._id })
          .populate("doctor", "name _id")
          .populate("hospital", "name _id")
          .populate("services.service")
          .lean();

        const appointments = Array.isArray(patient.appointments)
          ? patient.appointments.map((appointment) => ({
              caseId: appointment.caseId || "N/A",
              typeVisit: appointment.type || "N/A",
              branch: appointment.department?.name || "N/A",
              date: appointment.tokenDate
                ? new Date(appointment.tokenDate).toLocaleDateString("en-GB")
                : "N/A",
              status: appointment.status || "N/A",
              doctorName: appointment.doctor?.name || "N/A",
            }))
          : [];

        const doctorNames = patient.doctors.map((doctor) => ({
          id: doctor._id,
          name: doctor.name,
        }));

        return {
          ...patient.toObject(),
          appointments,
          doctors: doctorNames,
          bills,
          consultations,
        };
      })
    );

    return res.status(200).json({
      message: "Patients retrieved successfully",
      count: patientData.length,
      totalPatients,
      totalPages: Math.ceil(totalPatients / limit),
      currentPage: page,
      patients: patientData,
    });
  } catch (error) {
    console.error("Error fetching patients:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch patients", error: error.message });
  }
};

// Get Patients by Status with Sorting
export const getPatientsByStatus = async (req, res) => {
  try {
    const { status, typeVisit } = req.query;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res
        .status(403)
        .json({ message: "Access denied. No hospital context found." });
    }

    // Construct dynamic filter
    const filter = { hospital: hospitalId };

    if (status) {
      if (!["active", "inactive"].includes(status)) {
        return res
          .status(400)
          .json({ message: "Invalid status. Use 'active' or 'inactive'." });
      }
      filter.status = status;
    }

    if (typeVisit) {
      filter.typeVisit = typeVisit;
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;
    const sortOrder = req.query.sort === "asc" ? 1 : -1; // Default: Newest first (desc)

    // Fetch total count of patients
    const totalPatients = await Patient.countDocuments(filter);

    // Fetch and sort patients before pagination
    const patients = await Patient.find(filter)
      .populate({
        path: "appointments",
        select: "caseId tokenDate status department",
        populate: { path: "department", select: "name" },
      })
      .populate("doctors", "name specialization")
      .select("-password")
      .sort({ registrationDate: sortOrder }) // ✅ Sort patients before pagination
      .skip(skip)
      .limit(limit);

    // Process patient data and fetch corresponding bills
    const patientData = await Promise.all(
      patients.map(async (patient) => {
        const bills = await Bill.find({ patient: patient._id })
          .populate("doctor", "name _id")
          .populate("hospital", "name _id")
          .populate("services.service")
          .lean();

        return {
          ...patient.toObject(),
          bills,
        };
      })
    );

    return res.status(200).json({
      message: "Patients retrieved successfully",
      hospitalId,
      appliedFilters: { status, typeVisit },
      count: patientData.length,
      totalPatients,
      totalPages: Math.ceil(totalPatients / limit),
      currentPage: page,
      patients: patientData,
    });
  } catch (error) {
    console.error("Error fetching patients by status:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch patients.", error: error.message });
  }
};

// Get Appointments by Patient ID
export const getAppointmentsByPatientId = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: "Patient ID is required." });
    }

    const appointments = await Appointment.find({ patient: patientId })
      .populate("doctor", "name specialization")
      .populate("department", "name")
      .populate("hospital", "name")
      .populate("patient", "patId name")
      .sort({ tokenDate: -1 }); // recent first

    if (!appointments || appointments.length === 0) {
      return res
        .status(404)
        .json({ message: "No appointments found for this patient." });
    }

    return res.status(200).json({
      message: "Appointments retrieved successfully.",
      count: appointments.length,
      appointments,
    });
  } catch (error) {
    console.error("Error fetching appointments by patient:", error);
    return res.status(500).json({
      message: "Failed to fetch appointments.",
      error: error.message,
    });
  }
};

// Get Patient Details by ID
export const getPatientDetailsById = async (req, res) => {
  try {
    const { patientId } = req.params;

    if (!patientId) {
      return res.status(400).json({ message: "Patient ID is required." });
    }

    const patient = await Patient.findById(patientId)
      .select("-password -appointments -files -__v")
      .populate("doctors", "name email specialization")
      .populate("department", "name")
      .lean();

    if (!patient) {
      return res.status(404).json({ message: "Patient not found." });
    }

    const consultations = await Consultation.find({ patient: patientId })
      .populate("doctor", "name")
      .populate("department", "name")
      .sort({ date: -1 })
      .lean();

    const latestConsultation =
      consultations.length > 0 ? consultations[0] : null;
    const latestConsultationData = latestConsultation?.consultationData || null;

    const additionalFields = {
      bloodGroup: latestConsultationData?.bloodGroup ?? null,
      visitType: latestConsultationData?.visitType ?? null,
      condition: latestConsultationData?.condition ?? null,
      emergencyContact: latestConsultationData?.emergencyContact ?? null,
      relationship: latestConsultationData?.relationship ?? null,
      emergencyContactName:
        latestConsultationData?.emergencyContactName ?? null,
      MRN: latestConsultationData?.MRN ?? null,
      admittingBy: latestConsultationData?.admittingBy ?? null,
      admissionDateTime: latestConsultationData?.admissionDateTime ?? null,
    };

    return res.status(200).json({
      message: "Patient details retrieved successfully.",
      data: {
        ...patient,
        consultations,
        ...additionalFields,
      },
    });
  } catch (error) {
    console.error("Error fetching patient details:", error);
    return res.status(500).json({
      message: "Failed to fetch patient details.",
      error: error.message,
    });
  }
};

//Get Inpatients
export const getInpatients = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital ID is required" });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Sorting
    const sortOrder = req.query.sort === "asc" ? 1 : -1;

    // Filters
    const statusFilter = req.query.status
      ? req.query.status.split(",") // allow multiple statuses
      : [];

    // Fetch admitted patients
    const admittedPatients = await Patient.find({
      hospital: hospitalId,
      admissionStatus: "Admitted"
    })
      .select("-password")
      .populate("doctors", "name specialization")
      .lean();

    // Fetch follow-up consultations
    const followUpConsultations = await Consultation.find({
      followUpRequired: true
    })
      .populate({
        path: "patient",
        match: { hospital: hospitalId },
        select: "-password"
      })
      .populate("doctor", "name specialization")
      .populate("department", "name")
      .lean();

    // Combine follow-up patients
    const followUpPatients = followUpConsultations
      .filter((consultation) => consultation.patient)
      .map((consultation) => ({
        ...consultation.patient,
        consultation: consultation,
        doctors: consultation.doctor ? [consultation.doctor] : []
      }));

    // Merge admitted & follow-up patients (avoid duplicates)
    const inpatientMap = new Map();

    admittedPatients.forEach((patient) => {
      inpatientMap.set(patient._id.toString(), {
        ...patient,
        consultation: null
      });
    });

    followUpPatients.forEach((patientData) => {
      const patientId = patientData._id.toString();
      if (!inpatientMap.has(patientId)) {
        inpatientMap.set(patientId, patientData);
      } else {
        // Add consultation if exists
        const existingPatient = inpatientMap.get(patientId);
        existingPatient.consultation = patientData.consultation;
      }
    });

    // Convert to array
    let allInpatients = Array.from(inpatientMap.values());

    // Filter by status
    if (statusFilter.length > 0) {
      allInpatients = allInpatients.filter((patient) => {
        const status =
          patient.consultation?.referralUrgency ||
          patient.healthStatus ||
          "Stable";
        return statusFilter.includes(status);
      });
    }

    // Sort by registration date
    allInpatients.sort((a, b) => {
      const dateA = new Date(a.registrationDate || 0);
      const dateB = new Date(b.registrationDate || 0);
      return sortOrder === 1 ? dateA - dateB : dateB - dateA;
    });

    const totalInpatients = allInpatients.length;
    const paginatedInpatients = allInpatients.slice(skip, skip + limit);

    // Fetch bed assignments for paginated patients
    const patientIds = paginatedInpatients.map((patient) => patient._id);
    const bedAssignments = await Bed.find({
      assignedPatient: { $in: patientIds },
      status: "Occupied"
    })
      .populate("room", "roomID name roomType")
      .lean();

    // Create a bed map
    const bedMap = new Map();
    bedAssignments.forEach((bed) => {
      bedMap.set(bed.assignedPatient.toString(), bed);
    });

    // Final response mapping
    const inpatientData = paginatedInpatients.map((patient) => {
      const consultation = patient.consultation;
      const doctor = patient.doctors?.[0] || consultation?.doctor || null;
      const assignedBed = bedMap.get(patient._id.toString());

      return {
        _id: patient._id,
        patId: patient.patId,
        name: patient.name,
        email: patient.email,
        phone: patient.phone,
        bedNumber: assignedBed?.bedNumber || "Not Assigned",
        bedType: assignedBed?.bedType || null,
        roomID: assignedBed?.room?.roomID || null,
        roomName: assignedBed?.room?.name || null,
        roomType: assignedBed?.room?.roomType || null,
        condition:
          consultation?.primaryDiagnosis ||
          patient.healthStatus ||
          "Not Specified",
        doctor: doctor
          ? {
              _id: doctor._id,
              name: doctor.name
            }
          : null,
        status:
          consultation?.referralUrgency ||
          patient.healthStatus ||
          "Stable", // same field used for filtering
        admissionStatus: patient.admissionStatus,
        followUpRequired: consultation?.followUpRequired || false,
        assignedDate: assignedBed?.assignedDate || null
      };
    });

    return res.status(200).json({
      message: "Inpatients retrieved successfully",
      count: paginatedInpatients.length,
      totalInpatients,
      totalPages: Math.ceil(totalInpatients / limit),
      currentPage: page,
      inpatients: inpatientData
    });
  } catch (error) {
    console.error("Error fetching inpatients:", error);
    res.status(500).json({
      message: "Failed to fetch inpatients",
      error: error.message
    });
  }
};

// Get Surgery Patients
export const getPatientsInSurgery = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital ID is required" });
    }

    // Pagination
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Sorting order
    const sortOrder = req.query.sort === "asc" ? 1 : -1;

    // Status filter (optional)
    const statusFilter = req.query.status ? req.query.status.split(",") : [];

    // Get all Progress documents (no hospital filter at root)
    const progressDocs = await Progress.find({})
      .populate({
        path: "patient",
        select: "patId name email phone hospital"
      })
      .populate("logs.doctor", "name specialization")
      .lean();

    let validSurgeryLogs = [];

    progressDocs.forEach((progress) => {
      if (!progress.patient || !progress.logs || progress.logs.length === 0) return;

      // ✅ Only consider logs that belong to this hospital
      const hospitalLogs = progress.logs.filter(
        (log) => log.department && log.department.toString() === hospitalId
      );
      if (hospitalLogs.length === 0) return;

      // ✅ Sort logs by date (latest first)
      const latestLog = [...hospitalLogs].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )[0];

      // ✅ Only if latest log is Surgery
      if (latestLog.title === "Surgery") {
        validSurgeryLogs.push({
          patient: progress.patient,
          caseId: latestLog.caseId,
          date: latestLog.date,
          doctor: latestLog.doctor,
          department: latestLog.department,
          status: latestLog.status || "Scheduled",
          createdAt: progress.createdAt,
          updatedAt: progress.updatedAt
        });
      }
    });

    // Apply status filter
    if (statusFilter.length > 0) {
      validSurgeryLogs = validSurgeryLogs.filter((log) =>
        statusFilter.includes(log.status)
      );
    }

    const totalSurgeries = validSurgeryLogs.length;

    // Paginate
    const paginatedSurgeries = validSurgeryLogs
      .sort((a, b) => (sortOrder === 1 ? a.date - b.date : b.date - a.date))
      .slice(skip, skip + limit);

    // Fetch appointments for caseIds
    const caseIds = paginatedSurgeries.map((log) => log.caseId);
    const patientIds = paginatedSurgeries.map((log) => log.patient._id);

    const appointments = await Appointment.find({
      patient: { $in: patientIds },
      caseId: { $in: caseIds }
    })
      .populate("department", "name")
      .lean();

    // Map appointments by caseId
    const appointmentMap = new Map();
    appointments.forEach((appt) => {
      appointmentMap.set(appt.caseId, appt);
    });

    // Prepare final response
    const surgeryData = paginatedSurgeries.map((log) => {
      const appointment = appointmentMap.get(log.caseId);
      return {
        patId: log.patient.patId || "XXXXXXX",
        patient: {
          name: log.patient.name,
          email: log.patient.email
        },
        date: log.date
          ? new Date(log.date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            })
          : null,
        surgeryType: appointment?.type || appointment?.department?.name || null,
        doctor: log.doctor ? `Dr. ${log.doctor.name}` : null,
        status: log.status,
        caseId: log.caseId,
        createdAt: log.createdAt,
        updatedAt: log.updatedAt
      };
    });

    return res.status(200).json({
      message: "Patients in surgery retrieved successfully",
      count: paginatedSurgeries.length,
      totalSurgeries,
      totalPages: Math.ceil(totalSurgeries / limit),
      currentPage: page,
      surgeries: surgeryData
    });
  } catch (error) {
    console.error("Error fetching patients in surgery:", error);
    res.status(500).json({
      message: "Failed to fetch patients in surgery",
      error: error.message
    });
  }
};


export const updateHealthStatus = async (req, res) => {
  try {
    const { patientId } = req.params;
    const { status } = req.body; // Expected: "Normal" or "Critical"

    if (!["Stable", "Critical", "High", "Moderate"].includes(status)) {
      return res.status(400).json({ message: "Invalid status value" });
    }

    const patient = await Patient.findByIdAndUpdate(
      patientId,
      { healthStatus: status },
      { new: true }
    );

    if (!patient) {
      return res.status(404).json({ message: "Patient not found" });
    }

    res.status(200).json({
      message: `Patient health status updated to ${status}`,
      patient
    });

  } catch (error) {
    console.error("Error updating health status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getCriticalPatients = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Unauthorized. Hospital ID missing." });
    }

    // Find patients with Critical status in this hospital
    const criticalPatients = await Patient.find({
      hospital: hospitalId,
      healthStatus: "Critical"
    })
      .select("name patientID age gender phone healthStatus") // optional select
      .lean();

    if (criticalPatients.length === 0) {
      return res.status(200).json({ message: "No patients in Critical status", patients: [] });
    }

    res.status(200).json({
      message: "Critical patients fetched successfully",
      count: criticalPatients.length,
      patients: criticalPatients
    });
  } catch (error) {
    console.error("Error fetching critical patients:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

// Get count of active patients
export const getActivePatientCount = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital ID is required" });
    }

    const count = await Patient.countDocuments({
      hospital: hospitalId,
      status: "active",
    });

    return res.status(200).json({
      message: "Active patient count retrieved successfully",
      activePatientCount: count,
    });
  } catch (error) {
    console.error("Error fetching active patient count:", error);
    res.status(500).json({
      message: "Failed to fetch active patient count",
      error: error.message,
    });
  }
};
export const getPatientDetailsbyPatId = async (req, res) => {
  try {
    const { patientId } = req.params; // Get patientId from the URL parameter

    // Find patient details by patientId
    const patient = await Patient.findOne({ patId: patientId }).select('name phone address age');

    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Return the patient details
    res.status(200).json({
      message: 'Patient details fetched successfully',
      patient: {
        name: patient.name,
        phone: patient.phone,
        address: patient.address,
        age: patient.age
      }
    });
  } catch (error) {
    console.error('Error fetching patient details:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};

export const getTop4Procedures = async (req, res) => {
  try {
    // Time filter (weekly, monthly, yearly)
    const filter = req.query.filter || "all"; // default is all
    let startDate = null;

    if (filter === "weekly") {
      startDate = moment().subtract(7, "days").startOf("day").toDate();
    } else if (filter === "monthly") {
      startDate = moment().startOf("month").toDate();
    } else if (filter === "yearly") {
      startDate = moment().startOf("year").toDate();
    }

    // Get all Progress documents
    const progressDocs = await Progress.find({})
      .select("logs patient")
      .lean();

    const titleCounts = {};
    let processedPatients = 0;

    progressDocs.forEach((progress) => {
      if (!progress.logs || progress.logs.length === 0) return;

      // Sort logs by date and get latest
      const latestLog = [...progress.logs].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )[0];

      // Ignore logs without title
      if (!latestLog.title) return;

      // ✅ Apply time filter
      if (startDate && new Date(latestLog.date) < startDate) return;

      processedPatients++;

      // Count the titles
      titleCounts[latestLog.title] =
        (titleCounts[latestLog.title] || 0) + 1;
    });

    // Sort titles and take top 4
    const sortedTitles = Object.entries(titleCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4);

    const result = sortedTitles.map(([title, count]) => ({
      title,
      count
    }));

    return res.status(200).json({
      message: "Top 4 procedures retrieved successfully",
      filter,
      totalProcedures: processedPatients,
      topProcedures: result
    });
  } catch (error) {
    console.error("Error fetching top procedures:", error);
    return res.status(500).json({
      message: "Failed to fetch top procedures",
      error: error.message
    });
  }
};


export const getMostCommonDiagnosis = async (req, res) => {
  try {
    // Fetch all Progress documents (later we can add hospital filter)
    const progressDocs = await Progress.find({})
      .select("logs patient")
      .lean();

    const diagnosisCounts = {};
    let totalDiagnosis = 0;

    progressDocs.forEach((progress) => {
      if (!progress.logs || progress.logs.length === 0) return;

      // ✅ Find the latest log based on date
      const latestLog = [...progress.logs].sort(
        (a, b) => new Date(b.date) - new Date(a.date)
      )[0];

      // Extract diagnosis from multiple possible locations
      let diagnosis =
        latestLog.consultationData?.diagnosis ||
        latestLog.consultationData?.diagnosisAndVitals?.diagnosis ||
        latestLog.consultationData?.vitals?.diagnosis;

      if (!diagnosis || diagnosis.trim() === "") return;

      const cleanDiagnosis = diagnosis.trim();

      // Count diagnosis
      diagnosisCounts[cleanDiagnosis] =
        (diagnosisCounts[cleanDiagnosis] || 0) + 1;
      totalDiagnosis++;
    });

    // Sort by count and get top 5
    const sortedDiagnosis = Object.entries(diagnosisCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([diagnosis, count]) => ({ diagnosis, count }));

    return res.status(200).json({
      message: "Most common diagnosis retrieved successfully (Latest logs only)",
      totalDiagnosis,
      commonDiagnosis: sortedDiagnosis
    });
  } catch (error) {
    console.error("Error fetching most common diagnosis:", error);
    res.status(500).json({
      message: "Failed to fetch most common diagnosis",
      error: error.message
    });
  }
};
