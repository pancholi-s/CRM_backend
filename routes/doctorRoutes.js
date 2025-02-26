import express from 'express';
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

import { getDoctorsByHospital, getDoctorsByDepartment } from "../controllers/doctorController.js"

const router = express.Router();
router.use(requireHospitalContext);

router.get("/getDoctorsByHospital", authorizeRoles("receptionist", "hospitalAdmin"), getDoctorsByHospital)

router.get("/getDoctorsByDepartment/:departmentId", authorizeRoles("receptionist", "hospitalAdmin"), getDoctorsByDepartment);

export default router;