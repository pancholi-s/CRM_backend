import Vitals from "../models/VitalTrackerModel.js";
import MedicalRecord from "../models/medicalRecordsModel.js";

// Record vitals dynamically
export const recordVitals = async (req, res) => {
  try {
    const { patient, recordedBy, caseId, vitals } = req.body;

    if (!patient || !recordedBy || !caseId || !vitals || typeof vitals !== 'object') {
      return res.status(400).json({ message: "Patient, recordedBy, caseId, and vitals (object) are required." });
    }

    const newVitals = await Vitals.create({
      patient,
      recordedBy,
      caseId,
      vitals,
      recordedAt: new Date()
    });

    res.status(201).json({
      message: "Vitals recorded successfully",
      data: newVitals
    });
  } catch (error) {
    console.error("Vitals record error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

// Get vitals by patient
export const getVitalsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const vitals = await Vitals.find({ patient: patientId }).sort({ recordedAt: -1 });

    res.status(200).json({
      message: "Vitals fetched successfully",
      vitals
    });
  } catch (error) {
    console.error("Vitals fetch error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


export const addMedicalRecord = async (req, res) => {
  try {
    const { patient, medication, dose, route, time, givenBy, notes, status } = req.body;

    if (!patient || !medication || !dose || !route || !time || !givenBy || !status) {
      return res.status(400).json({ message: "All medical record fields are required." });
    }

    const record = await MedicalRecord.create({
      patient,
      medication,
      dose,
      route,
      time,
      givenBy,
      notes,
      status
    });

    res.status(201).json({ message: "Medical record added", data: record });
  } catch (error) {
    console.error("Medical record error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getMedicalRecords = async (req, res) => {
  try {
    const { patientId } = req.params;

    const records = await MedicalRecord.find({ patient: patientId }).sort({ createdAt: -1 });

    res.status(200).json({ message: "Medical records fetched", records });
  } catch (error) {
    console.error("Medical record fetch error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
