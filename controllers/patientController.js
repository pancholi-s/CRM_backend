import Patient from "../models/patientModel.js";
import Bill from "../models/billModel.js";

export const getPatientsByHospital = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital ID is required" });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch total count of patients
    const totalPatients = await Patient.countDocuments({ hospital: hospitalId });

    // Fetch patients with pagination, populated appointments and nested doctor/department fields
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
      .skip(skip)
      .limit(limit);

    if (!patients || patients.length === 0) {
      return res.status(404).json({ message: "No patients found for this hospital" });
    }

    console.log("Fetched Patients:", JSON.stringify(patients, null, 2));

    // Process patient data and fetch corresponding bills
    const patientData = await Promise.all(
      patients.map(async (patient) => {
        // Fetch bills associated with the patient
        const bills = await Bill.find({ patient: patient._id })
          .select("caseId totalAmount paidAmount outstanding status invoiceNumber invoiceDate mode")
          .populate("doctor", "name _id");

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

        // Extract doctor names from the populated doctors array
        const doctorNames = patient.doctors.map((doctor) => ({
          id: doctor._id,
          name: doctor.name,
        }));

        return {
          ...patient.toObject(), // Include all patient fields
          appointments, // Add transformed appointments data
          doctors: doctorNames,
          bills, // Add the corresponding bills
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


export const getPatientsByStatus = async (req, res) => {
  try {
    const { status } = req.query;
    const hospitalId = req.session.hospitalId;

    if (!['active', 'inactive'].includes(status)) {
      return res.status(400).json({ message: "Invalid status. Use 'active' or 'inactive'." });
    }

    if (!hospitalId) {
      return res.status(403).json({ message: "Access denied. No hospital context found." });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch total count of patients with the given status
    const totalPatients = await Patient.countDocuments({ status: status, hospital: hospitalId });

    // Fetch patients based on status and hospital context with pagination
    const patients = await Patient.find({ status: status, hospital: hospitalId })
      .populate('appointments', 'caseId tokenDate status') // Populate appointment details
      .populate('doctors', 'name specialization') // Populate doctor details
      .select('-password -medicalHistory -socialHistory') // Exclude sensitive fields
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      message: "Patients retrieved successfully",
      hospitalId,
      status,
      count: patients.length,
      totalPatients,
      totalPages: Math.ceil(totalPatients / limit),
      currentPage: page,
      patients,
    });
  } catch (error) {
    console.error('Error fetching patients by status:', error);
    res.status(500).json({ message: 'Failed to fetch patients.', error: error.message });
  }
};
