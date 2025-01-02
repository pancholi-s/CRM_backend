import express from "express"
import { getPatientsByHospital, getPatientsByStatus  } from "../controllers/patientController.js"
import { requireHospitalContext } from '../controllers/hospitalContext.js';

const router = express.Router()
router.use(requireHospitalContext);

router.get("/getPatientsByHospital",getPatientsByHospital)
router.get("/getPatientsByStatus", getPatientsByStatus);

export default router;
