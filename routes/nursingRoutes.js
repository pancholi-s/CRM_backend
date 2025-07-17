import express from "express";
import {recordVitals, getVitalsByPatient, addMedicalRecord,updateMedicationAction, getMedicalRecords} from "../controllers/nursingSection.js";

const router = express.Router();

// Vitals
router.post("/recordVitals", recordVitals);
router.get("/getVitalsByPatient/:patientId", getVitalsByPatient);

// Medications
router.post("/addMedicalRecord", addMedicalRecord);
router.post("/updateMedicationAction", updateMedicationAction);
router.get("/getMedicalRecords/:patientId", getMedicalRecords);

export default router;
