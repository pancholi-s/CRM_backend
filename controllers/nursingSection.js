import Vitals from "../models/VitalTrackerModel.js";
import MedicalRecord from "../models/medicalRecordsModel.js";

export const recordVitals = async (req, res) => {
  try {
    const { patient, heartRate, temperature, bloodPressure, spo2 } = req.body;

    if (!patient || !heartRate || !temperature || !bloodPressure || !spo2) {
      return res.status(400).json({ message: "All vitals fields are required." });
    }

    const newVitals = await Vitals.create({
      patient,
      heartRate,
      temperature,
      bloodPressure,
      spo2,
      recordedAt: new Date()
    });

    res.status(201).json({ message: "Vitals recorded successfully", data: newVitals });
  } catch (error) {
    console.error("Vitals record error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getVitalsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const vitals = await Vitals.find({ patient: patientId }).sort({ recordedAt: -1 });

    res.status(200).json({ message: "Vitals fetched", vitals });
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
