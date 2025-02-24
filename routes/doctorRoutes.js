import express from 'express';
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

import { getDoctorsByHospital } from "../controllers/doctorController.js"

const router = express.Router();
router.use(requireHospitalContext);

router.get("/getDoctorsByHospital", authorizeRoles("receptionist", "hospitalAdmin"), getDoctorsByHospital)

export default router;