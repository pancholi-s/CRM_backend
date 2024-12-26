import mongoose from 'mongoose';
import Patient from '../models/patientModel.js';

export const getPatientsByHospital = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId; // Retrieve hospital ID from session
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital ID is required" });
    }

    // Fetch patients with populated appointments and nested doctor/department fields
    const patients = await Patient.find({ hospital: hospitalId })
      .select('-address -email -password') // Exclude address, email, and password fields
      .populate({
        path: 'appointments',
        populate: [
          { path: 'doctor', select: 'name _id' },
          { path: 'department', select: 'name' },
        ],
      });

    if (!patients || patients.length === 0) {
      return res.status(404).json({ message: "No patients found for this hospital" });
    }

    console.log("Fetched Patients:", JSON.stringify(patients, null, 2));

    // Process patient data and filter/transform appointments
    const patientData = patients.map((patient) => {
      const appointments = Array.isArray(patient.appointments)
        ? patient.appointments.map((appointment) => ({
            caseId: appointment.caseId || "N/A",
            typeVisit: appointment.type || "N/A",
            branch: appointment.department?.name || "N/A",
            date: appointment.tokenDate
              ? new Date(appointment.tokenDate).toLocaleDateString('en-GB')
              : "N/A",
            status: appointment.status || "N/A",
            doctorName: appointment.doctor?.name || "N/A",
          }))
        : [];

      // Return all patient attributes except excluded fields
      return {
        ...patient.toObject(), // Include all patient fields
        appointments, // Add transformed appointments data
      };
    });

    // Check if any valid patients with appointments exist
    if (patientData.length === 0) {
      console.warn("No valid appointments found across all patients.");
      return res.status(404).json({
        message: "No valid appointments found for patients in this hospital",
      });
    }

    return res.status(200).json({
      message: "Patients retrieved successfully",
      count: patientData.length,
      patients: patientData,
    });
  } catch (error) {
    console.error("Error fetching patients:", error);
    res.status(500).json({ message: "Failed to fetch patients", error: error.message });
  }
};
