import express from "express";
import {recordVitals, getVitalsByPatient, addMedicalRecord,updateMedicationAction, getMedicalRecords, searchMedicines} from "../controllers/nursingSection.js";
// import { updateBillAfterAction } from "../middleware/billingMiddleware.js"; // Import the billing middleware function

const router = express.Router();

// Vitals
router.post("/recordVitals", recordVitals);
router.get("/getVitalsByPatient/:patientId", getVitalsByPatient);

// Medications
router.post("/addMedicalRecord", addMedicalRecord);
router.post("/updateMedicationAction", updateMedicationAction);
router.get("/getMedicalRecords/:patientId", getMedicalRecords);
router.get("/searchMedicines", searchMedicines);

export default router;
