import express from "express";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";
import {
  getPatientOverview,
  getInpatientsList,
  getAllAppointedPatients,
} from "../controllers/patientOverviewController.js";

const router = express.Router();

router.use(requireHospitalContext);

router.get(
  "/overview",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getPatientOverview
);

router.get(
  "/inpatients",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getInpatientsList
);

router.get(
  "/appointed-patients",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getAllAppointedPatients
);

export default router;
