import express from "express";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";
import {
  getMedicalProceduresStats,
  getHeaderStats,
  getPatientsByCategory
} from "../controllers/procedureController.js";

const router = express.Router();

router.use(requireHospitalContext);

router.get("/medical-procedures", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getMedicalProceduresStats
);


router.get("/header-stats", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getHeaderStats
);

router.get("/patients/:category", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getPatientsByCategory
);


export default router;