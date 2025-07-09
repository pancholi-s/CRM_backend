import express from "express";
import {
  generatePrescription,
  getPrescriptionsByPatient,
  updatePrescription,
  approvePrescription,
} from "../controllers/prescriptionController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

const router = express.Router();

router.post(
  "/generate-prescription",
  requireHospitalContext,
  authorizeRoles("doctor"),
  generatePrescription
);

router.get(
  "/prescriptions/:patientId",
  authorizeRoles("hospitalAdmin", "doctor", "receptionist"),
  getPrescriptionsByPatient
);

router.patch(
  "/prescriptions/:id",
  authorizeRoles("doctor"),
  updatePrescription
);

router.patch(
  "/prescriptions/:id/approve",
  authorizeRoles("doctor"),
  approvePrescription
);

export default router;
