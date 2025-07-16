import express from "express";
import {recordVitals, getVitalsByPatient, addMedicalRecord, getMedicalRecords} from "../controllers/nursingSection.js";

const router = express.Router();

// Vitals
router.post("/recordVitals", recordVitals);
router.get("/getVitalsByPatient/:patientId", getVitalsByPatient);

// Medications
router.post("/addMedicalRecord", addMedicalRecord);
router.get("/getMedicalRecords/:patientId", getMedicalRecords);

export default router;
