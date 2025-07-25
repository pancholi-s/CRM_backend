import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from '../middleware/hospitalContext.js';
import { paginationMiddleware } from '../middleware/paginationMiddleware.js';

import { getPatientsByHospital, getPatientsByStatus,getAppointmentsByPatientId, getPatientDetailsById,getInpatients, getPatientsInSurgery,updateHealthStatus , getActivePatientCount  } from "../controllers/patientController.js"

const router = express.Router()
router.use(requireHospitalContext);

router.post("/updateHealthStatus/:patientId", authorizeRoles("doctor", "hospitalAdmin"), updateHealthStatus,updateHealthStatus)
router.get("/getPatientsByHospital", authorizeRoles("receptionist", "hospitalAdmin", "doctor"), getPatientsByHospital,paginationMiddleware)
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

router.get(
  "/getInpatients", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"), 
  getInpatients,
  paginationMiddleware
);

router.get(
  "/getpatientsinsurgery", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"), 
  getPatientsInSurgery,
  paginationMiddleware
);

router.get(
  "/count/active",
  authorizeRoles("doctor","receptionist", "hospitalAdmin"),
  getActivePatientCount
);


export default router;
