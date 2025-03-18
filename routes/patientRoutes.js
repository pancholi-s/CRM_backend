import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from '../middleware/hospitalContext.js';
import { paginationMiddleware } from '../middleware/paginationMiddleware.js';

import { getPatientsByHospital, getPatientsByStatus  } from "../controllers/patientController.js"

const router = express.Router()
router.use(requireHospitalContext);

router.get("/getPatientsByHospital", authorizeRoles("receptionist", "hospitalAdmin"), getPatientsByHospital,paginationMiddleware)
router.get("/getPatientsByStatus", authorizeRoles("receptionist", "hospitalAdmin"), getPatientsByStatus ,paginationMiddleware);

export default router;
