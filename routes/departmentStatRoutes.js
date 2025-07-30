import express from "express";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";
import { getHospitalStats } from "../controllers/departmentStatController.js";

const router = express.Router();

router.use(requireHospitalContext);

router.get(
  "/getHospitalStats",
  authorizeRoles("doctor", "hospitalAdmin", "receptionist"),
  getHospitalStats
);

export default router;
