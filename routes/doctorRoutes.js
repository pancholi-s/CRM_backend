import express from 'express';
import { authorizeRoles } from "../middleware/roleMiddleware.js";

import { getDoctorsByHospital } from "../controllers/doctorController.js"

const router = express.Router();

router.get("/getDoctorsByHospital", authorizeRoles("receptionist", "hospitalAdmin"), getDoctorsByHospital)

export default router;