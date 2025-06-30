import express from "express";
import {
  markPatientCritical,
  getCriticalPatients,
  resolveCriticalAlert
} from "../controllers/criticalPatientsController.js";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

const router = express.Router();

router.post(
  "/critical-patients",
  requireHospitalContext,
  authorizeRoles("doctor"),
  markPatientCritical
);

router.get(
  "/critical-patients",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "receptionist"),
  getCriticalPatients
);

router.patch(
  "/critical-patients/:id/resolve",
  requireHospitalContext,
  authorizeRoles("doctor"),
  resolveCriticalAlert
);

export default router;
