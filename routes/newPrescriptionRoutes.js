import express from "express";
import {
  createAIPrescription,
  getPatientPrescriptions,
  getPrescriptionById,
  updatePrescriptionSections,
  approvePrescriptionById,
  deletePrescriptionById,
} from "../controllers/newPrescriptionController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

const router = express.Router();

router.post(
  "/generate",
  requireHospitalContext,
  authorizeRoles("doctor"),
  createAIPrescription
);

router.get(
  "/newprescription/patient/:patientId",
  authorizeRoles("hospitalAdmin", "doctor", "receptionist"),
  getPatientPrescriptions
);

router.get(
  "/newprescription/:id",
  authorizeRoles("hospitalAdmin", "doctor", "receptionist"),
  getPrescriptionById
);

router.patch(
  "/newprescription/:id",
  authorizeRoles("doctor"),
  updatePrescriptionSections
);

router.patch(
  "/newprescription/:id/approve",
  authorizeRoles("doctor"),
  approvePrescriptionById
);

router.delete(
  "/newprescription/:id",
  authorizeRoles("doctor", "hospitalAdmin"),
  deletePrescriptionById
);

export default router;
