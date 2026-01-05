import Vitals from "../models/VitalTrackerModel.js";
import MedicalRecord from "../models/medicalRecordsModel.js";
import Service from "../models/serviceModel.js";
import { updateBillAfterAction } from "../middleware/billingMiddleware.js"; // Import the billing middleware function

// Record vitals dynamically
export const recordVitals = async (req, res) => {
  try {
    const { patient, recordedBy, vitals } = req.body;

    if (!patient || !recordedBy || !vitals || typeof vitals !== 'object') {
      return res.status(400).json({ message: "Patient, recordedBy, and vitals (object) are required." });
    }

    const newVitals = await Vitals.create({
      patient,
      recordedBy,
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
    const { patient, medications, caseId } = req.body;  // Include caseId here

    // Validation for required fields
    if (!patient || !Array.isArray(medications) || medications.length === 0 || !caseId) {
      return res.status(400).json({ message: "Patient, medications, and caseId are required." });
    }

    const records = medications.map((med) => {
      // Validation for individual medication fields
      if (!med.medication || !med.dose || !med.route || !med.time) {
        throw new Error("Each medication must include medication, dose, route, and time.");
      }

      return {
        patient,
        medication: med.medication,
        dose: med.dose,
        route: med.route,
        time: med.time,
        date: med.date || new Date(),
        givenBy: med.givenBy || "",
        notes: med.notes || "",
        status: med.status || "Scheduled",
        caseId  // Link the medical record to the correct caseId
      };
    });

    // Insert all medical records for the patient
    const inserted = await MedicalRecord.insertMany(records);

    // Return success response
    res.status(201).json({
      message: "Medical records added successfully",
      data: inserted
    });
  } catch (error) {
    console.error("Medical record insert error:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};


// Inside updateMedicationAction (nursingSection.js)

export const updateMedicationAction = async (req, res) => {
  const session = await MedicalRecord.startSession();  // Start a session for the current request
  session.startTransaction();  // Start the transaction

  try {
    const { recordId, action, givenBy, newTime, notes } = req.body;

    // Fetch the record from the MedicalRecord model
    const record = await MedicalRecord.findById(recordId).session(session); 
    if (!record) {
      return res.status(404).json({ message: "Medical record not found." });
    }

    // Prepare the medication details to be passed to the bill
    const medicationDetails = {
      dose: record.dose || "Not Specified",
      route: record.route || "Not Specified",
      time: record.time || "Not Specified",
      givenBy: record.givenBy || "Not Specified",
      notes: record.notes || "No notes",
    };

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

    // Save the updated record
    await record.save();

    // Step 1: Fetch Medication Service from Service collection
    const medicationService = await Service.findOne({ name: "Medication", hospital: record.hospital }).session(session);
    console.log("Fetched Medication Service:", medicationService);  // Log the fetched medication service

    // Step 2: Find the rate for the Medication service from the categories array
    let medicationRate = 0;  // Default to 0
    if (medicationService) {
      // Find the category with subCategoryName "Medication"
      const medicationCategory = medicationService.categories.find(
        category => category.subCategoryName === "Medication"
      );
      if (medicationCategory) {
        medicationRate = medicationCategory.rate; // Use the rate from the category
      }
    }

    console.log("Fetched Medication Rate:", medicationRate);  // Log the fetched rate

    // Step 3: Prepare Medication Charges with details
    const medicationCharge = {
      service: medicationService ? medicationService._id : null, // Set service ID or null if missing
      category: "Medication",
      quantity: 1,
      rate: medicationRate,  // Use the fetched rate
      details: medicationDetails,  // Pass the medication details here
    };

    console.log("Medication Charge:", medicationCharge);  // Log the medication charge before passing to `updateBillAfterAction`

    // Step 4: Call centralized updateBillAfterAction with the session
    await updateBillAfterAction(record.caseId, session, medicationCharge);  // Pass the `medicationCharge` to be included in services

    // Send Response
    res.status(200).json({
      message: `Medication successfully ${action === "Given" ? "marked as given" : "rescheduled"}.`,
      data: record
    });

  } catch (error) {
    console.error("Error updating medication action:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    // Always ensure the session is closed
    if (session) {
      session.endSession();
    }
  }
};


export const getMedicalRecords = async (req, res) => {
  try {
    const { patientId } = req.params;

    const records = await MedicalRecord.find({ patient: patientId })
      .sort({ createdAt: -1 })
      .lean(); // important so we can safely modify response

    const formattedRecords = records.map(record => {
      const createdAt = new Date(record.createdAt);

      return {
        ...record,
        date: createdAt.toISOString().split("T")[0], // YYYY-MM-DD
        time: createdAt.toLocaleTimeString("en-IN", {
          hour: "2-digit",
          minute: "2-digit",
          hour12: true
        }),
      };
    });

    res.status(200).json({
      message: "Medical records fetched",
      records: formattedRecords
    });

  } catch (error) {
    console.error("Medical record fetch error:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};

