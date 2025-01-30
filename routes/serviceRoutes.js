import express from "express";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

import { addService, getServices } from "../controllers/serviceController.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

const serviceRouter = express.Router();
serviceRouter.use(requireHospitalContext);

serviceRouter.post("/addService", authorizeRoles("hospitalAdmin"), addService);
serviceRouter.get("/getServices", authorizeRoles("receptionist", "hospitalAdmin"), getServices);

export default serviceRouter;
