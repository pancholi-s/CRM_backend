import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from '../middleware/hospitalContext.js';

import { getPatientsByHospital, getPatientsByStatus  } from "../controllers/patientController.js"

const router = express.Router()
router.use(requireHospitalContext);

router.get("/getPatientsByHospital", authorizeRoles("receptionist", "hospitalAdmin"), getPatientsByHospital)
router.get("/getPatientsByStatus", authorizeRoles("receptionist", "hospitalAdmin"), getPatientsByStatus);

export default router;
