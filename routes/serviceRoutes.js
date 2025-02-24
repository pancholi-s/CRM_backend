import express from "express";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

import { addService, getServices, editService,deleteService,deleteSubcategory } from "../controllers/serviceController.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/addService", authorizeRoles("hospitalAdmin"), addService);
router.get("/getServices", authorizeRoles("receptionist", "hospitalAdmin"), getServices);

router.put("/editService/edit", editService);  // Edit service
router.delete("/deleteService/delete/:serviceId", deleteService);
router.delete("/deleteSubcategory/:serviceId/:subcategoryId", deleteSubcategory);
export default router;
