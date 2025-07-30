import Patient from "../models/patientModel.js";
import Bill from "../models/billModel.js";
import Consultation from "../models/consultationModel.js";
import Appointment from "../models/appointmentModel.js";
import Bed from "../models/bedModel.js";
import ProgressPhase from "../models/ProgressPhase.js";

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

    // Sorting
    const sortOrder = req.query.sort === "asc" ? 1 : -1; // asc=oldest→newest, default=desc=newest→oldest

    // Filtering by status
    const statusFilter = req.query.status
      ? req.query.status.split(",") // allow multiple statuses in query
      : [];

    // Find all surgery progress phases
    const surgeryPhases = await ProgressPhase.find({
      title: "Surgery"
    })
      .populate({
        path: "patient",
        match: { hospital: hospitalId },
        select: "patId name email phone hospital"
      })
      .populate("assignedDoctor", "name specialization")
      .sort({ date: sortOrder }) // sort by date
      .lean();

    // Filter out patients not in the hospital
    let validSurgeryPhases = surgeryPhases.filter((phase) => phase.patient);

    // Apply status filter
    if (statusFilter.length > 0) {
      validSurgeryPhases = validSurgeryPhases.filter((phase) => {
        let status = "Scheduled"; // default status
        if (phase.isCancelled) status = "Cancelled";
        else if (phase.isDone) status = "Completed";
        return statusFilter.includes(status);
      });
    }

    // Total count
    const totalSurgeries = validSurgeryPhases.length;

    // Pagination
    const paginatedSurgeries = validSurgeryPhases.slice(skip, skip + limit);

    // Fetch Appointments for surgery type
    const patientIds = paginatedSurgeries.map((phase) => phase.patient._id);
    const caseIds = paginatedSurgeries.map((phase) => phase.caseId);

    const appointments = await Appointment.find({
      patient: { $in: patientIds },
      caseId: { $in: caseIds }
    })
      .populate("department", "name")
      .lean();

    // Create a map for quick appointment lookup by caseId
    const appointmentMap = new Map();
    appointments.forEach((appointment) => {
      appointmentMap.set(appointment.caseId, appointment);
    });

    // Format the response data
    const surgeryData = paginatedSurgeries.map((phase) => {
      const patient = phase.patient;
      const doctor = phase.assignedDoctor;
      const appointment = appointmentMap.get(phase.caseId);

      // Determine status for response
      let status = "Scheduled";
      if (phase.isCancelled) status = "Cancelled";
      else if (phase.isDone) status = "Completed";

      return {
        patId: patient.patId || "XXXXXXX",
        patient: {
          name: patient.name,
          email: patient.email
        },
        date: phase.date
          ? new Date(phase.date).toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            })
          : null,
        surgeryType:
          appointment?.type || appointment?.department?.name || null,
        doctor: doctor ? `Dr. ${doctor.name}` : null,
        status, // status after filtering logic
        caseId: phase.caseId,
        createdAt: phase.createdAt,
        updatedAt: phase.updatedAt
      };
    });

    // Response
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
