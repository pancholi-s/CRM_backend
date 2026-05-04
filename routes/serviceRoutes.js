import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";
import { upload } from "../middleware/uploadMiddleware.js";
import { addService, getServices, getPackages, editService, deleteService, deleteSubcategory, getServicesByDep, searchServiceSubCategories,uploadHospitalServicesExcel } from "../controllers/serviceController.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/addService", authorizeRoles("hospitalAdmin", "doctor"), addService);
router.get("/getServices", authorizeRoles("receptionist", "hospitalAdmin","doctor"), getServices);
router.get("/getservicesbydep/:id", authorizeRoles("receptionist", "hospitalAdmin","doctor"), getServicesByDep);
router.put("/editService/edit/:serviceId", authorizeRoles("receptionist", "hospitalAdmin","doctor"), editService);
router.delete("/deleteService/delete/:serviceId", authorizeRoles("receptionist", "hospitalAdmin","doctor"), deleteService);
router.delete("/deleteSubcategory/:serviceId/:subcategoryId", authorizeRoles("receptionist", "hospitalAdmin","doctor"), deleteSubcategory);

router.get("/getPackages", authorizeRoles("receptionist", "hospitalAdmin","doctor"),getPackages );
router.get("/searchServiceSubCategories", authorizeRoles("receptionist", "hospitalAdmin","doctor",'staff'),searchServiceSubCategories );

router.post(
  "/uploadHospitalServices",
  authorizeRoles("hospitalAdmin","doctor"),
  upload.single("file"),
  uploadHospitalServicesExcel
);

export default router;