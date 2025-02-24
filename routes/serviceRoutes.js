import express from "express";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

import { addService, getServices } from "../controllers/serviceController.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/addService", authorizeRoles("hospitalAdmin"), addService);
router.get("/getServices", authorizeRoles("receptionist", "hospitalAdmin"), getServices);

export default router;
