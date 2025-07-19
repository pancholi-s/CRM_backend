import express from "express";
import {
  addBedsToRoom,
  getBedsByHospital,
  assignPatientToBed,
  dischargePatientFromBed,
  getHospitalStatistics,
  getPatientBedInfo,
} from "../controllers/bedController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

const router = express.Router();

router.post(
  "/beds",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "receptionist"),
  addBedsToRoom
);

router.get(
  "/beds",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "receptionist"),
  getBedsByHospital
);

router.post(
  "/beds/assign",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "receptionist"),
  assignPatientToBed
);

router.patch(
  "/beds/:bedId/discharge",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "receptionist"),
  dischargePatientFromBed
);

router.get(
  "/statistics",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "receptionist"),
  getHospitalStatistics
);

router.get(
  "/patients/:patientId/bed-info",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "receptionist"),
  getPatientBedInfo
);


export default router;
