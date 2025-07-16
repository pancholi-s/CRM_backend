import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from '../middleware/hospitalContext.js';
import { paginationMiddleware } from '../middleware/paginationMiddleware.js';

import { getPatientsByHospital, getPatientsByStatus,getAppointmentsByPatientId, getPatientDetailsById  } from "../controllers/patientController.js"

const router = express.Router()
router.use(requireHospitalContext);

router.get("/getPatientsByHospital", authorizeRoles("receptionist", "hospitalAdmin"), getPatientsByHospital,paginationMiddleware)
router.get("/getPatientsByStatus", authorizeRoles("receptionist", "hospitalAdmin"), getPatientsByStatus ,paginationMiddleware);
router.get(
  "/:patientId/appointments",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getAppointmentsByPatientId
);
router.get(
  "/:patientId/details",
  authorizeRoles("receptionist", "hospitalAdmin", "doctor"),
  getPatientDetailsById
);
export default router;
