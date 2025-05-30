import Patient from "../models/patientModel.js";
import Bill from "../models/billModel.js";

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
    const totalPatients = await Patient.countDocuments({ hospital: hospitalId });

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
      return res.status(404).json({ message: "No patients found for this hospital" });
    }

    console.log("Fetched Patients:", JSON.stringify(patients, null, 2));

    // Process patient data and fetch corresponding bills
    const patientData = await Promise.all(
      patients.map(async (patient) => {
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
    res.status(500).json({ message: "Failed to fetch patients", error: error.message });
  }
};

// Get Patients by Status with Sorting
export const getPatientsByStatus = async (req, res) => {
  try {
    const { status, typeVisit } = req.query;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "Access denied. No hospital context found." });
    }

    // Construct dynamic filter
    const filter = { hospital: hospitalId };
    
    if (status) {
      if (!['active', 'inactive'].includes(status)) {
        return res.status(400).json({ message: "Invalid status. Use 'active' or 'inactive'." });
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
    res.status(500).json({ message: "Failed to fetch patients.", error: error.message });
  }
};
