import Patient from "../models/patientModel.js";
import Bill from "../models/billModel.js";
import Consultation from "../models/consultationModel.js";
import Appointment from "../models/appointmentModel.js";

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
// export const getPatientDetailsById = async (req, res) => {
//   try {
//     const { patientId } = req.params;

//     if (!patientId) {
//       return res.status(400).json({ message: "Patient ID is required." });
//     }

//     const patient = await Patient.findById(patientId)
//       .select("-password") // hide password
//       .populate("doctors", "name email specialization")
//       .populate("department", "name")
//       .populate({
//         path: "appointments",
//         populate: [
//           { path: "doctor", select: "name specialization" },
//           { path: "department", select: "name" },
//           { path: "hospital", select: "name" },
//         ],
//       });

//     if (!patient) {
//       return res.status(404).json({ message: "Patient not found." });
//     }

//     const consultations = await Consultation.find({ patient: patient._id })
//       .populate("doctor", "name")
//       .populate("department", "name")
//       .populate("appointment", "caseId tokenDate status")
//       .lean();

//     // const bills = await Bill.find({ patient: patient._id })
//     //   .populate("doctor", "name _id")
//     //   .populate("hospital", "name _id")
//     //   .populate("services.service")
//     //   .lean();

//       // Extract from latest consultation
//       const latestConsultationData =
//       consultations?.length > 0
//         ? consultations[consultations.length - 1]?.consultationData || null
//         : null;

//       // Prepare extra fields
//       const additionalFields = {
//         bloodGroup: latestConsultationData?.bloodGroup ?? null,
//         visitType: latestConsultationData?.visitType ?? null,
//         condition: latestConsultationData?.condition ?? null,
//         emergencyContact: latestConsultationData?.emergencyContact ?? null,
//         relationship: latestConsultationData?.relationship ?? null,
//         emergencyContactName: latestConsultationData?.emergencyContactName ?? null,
//         MRN: latestConsultationData?.MRN ?? null,
//         admittingBy: latestConsultationData?.admittingBy ?? null,
//         admissionDateTime: latestConsultationData?.admissionDateTime ?? null,
//       };

//     return res.status(200).json({
//       message: "Patient details retrieved successfully.",
//       data: {
//         ...patient.toObject(),
//         consultations,
//         bills,
//         ...additionalFields, // Include additional fields
//       },
//     });
//   } catch (error) {
//     console.error("Error fetching patient details:", error);
//     return res
//       .status(500)
//       .json({ message: "Failed to fetch patient details.", error: error.message });
//   }
// };

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
