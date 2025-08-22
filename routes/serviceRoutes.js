import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

import { addService, getServices, editService, deleteService, deleteSubcategory } from "../controllers/serviceController.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/addService", authorizeRoles("hospitalAdmin"), addService);
router.get("/getServices", authorizeRoles("receptionist", "hospitalAdmin"), getServices);

router.patch("/editService/edit/:serviceId", authorizeRoles("receptionist", "hospitalAdmin"), editService);
router.delete("/deleteService/delete/:serviceId", authorizeRoles("receptionist", "hospitalAdmin"), deleteService);
router.delete("/deleteSubcategory/:serviceId/:subcategoryId", authorizeRoles("receptionist", "hospitalAdmin"), deleteSubcategory);

export default router;
