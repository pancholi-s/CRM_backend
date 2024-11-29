import express from 'express';
import { getDoctorsByHospital } from "../controllers/doctorController.js"

const router = express.Router();

router.get("/getDoctorsByHospital",getDoctorsByHospital)

export default router;