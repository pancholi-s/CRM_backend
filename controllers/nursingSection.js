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
    const { patient, medications } = req.body;

    if (!patient || !Array.isArray(medications) || medications.length === 0) {
      return res.status(400).json({ message: "Patient and medications are required." });
    }

    const records = medications.map((med) => {
      if (!med.medication || !med.dose || !med.route || !med.time) {
        throw new Error("Each medication must include medication, dose, route, and time.");
      }

      return {
        patient,
        medication: med.medication,
        dose: med.dose,
        route: med.route,
        time: med.time,
        givenBy: med.givenBy || "",
        notes: med.notes || "",
        status: med.status || "Scheduled"
      };
    });

    const inserted = await MedicalRecord.insertMany(records);

    res.status(201).json({
      message: "Medical records added successfully",
      data: inserted
    });
  } catch (error) {
    console.error("Medical record insert error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


export const updateMedicationAction = async (req, res) => {
  try {
    const { recordId, action, givenBy, newTime, notes } = req.body;

    const record = await MedicalRecord.findById(recordId);
    if (!record) {
      return res.status(404).json({ message: "Medical record not found." });
    }

    if (action === "Given") {
      if (!givenBy) {
        return res.status(400).json({ message: "'givenBy' is required when marking as Given." });
      }

      record.status = "Given";
      record.givenBy = givenBy;
      if (notes) record.notes = notes;

    } else if (action === "Reschedule") {
      if (!newTime) {
        return res.status(400).json({ message: "'newTime' is required when rescheduling." });
      }

      record.time = newTime;
      record.status = "Scheduled"; // optional: you can use "Rescheduled" if you want to track this
      if (notes) record.notes = notes;
    } else {
      return res.status(400).json({ message: "Invalid action type. Must be 'Given' or 'Reschedule'." });
    }

    await record.save();

    res.status(200).json({
      message: `Medication successfully ${action === "Given" ? "marked as given" : "rescheduled"}.`,
      data: record
    });

  } catch (error) {
    console.error("Error updating medication action:", error);
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
