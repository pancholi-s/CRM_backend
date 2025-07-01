import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { paginationMiddleware } from '../middleware/paginationMiddleware.js';
import { requireHospitalContext } from "../middleware/hospitalContext.js";

import { getDoctorsByHospital, getDoctorsByDepartment } from "../controllers/doctorController.js"

const router = express.Router();
router.use(requireHospitalContext);

router.get("/getDoctorsByHospital", authorizeRoles("receptionist", "hospitalAdmin",'doctor'), getDoctorsByHospital, paginationMiddleware)
router.get("/getDoctorsByDepartment/:departmentId", authorizeRoles("receptionist", "hospitalAdmin",'doctor'), getDoctorsByDepartment, paginationMiddleware);

export default router;