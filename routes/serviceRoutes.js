import express from "express";
import { addService, getServices } from "../controllers/serviceController.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

const serviceRouter = express.Router();
serviceRouter.use(requireHospitalContext);

serviceRouter.post("/addService", addService);
serviceRouter.get("/getServices", getServices);

export default serviceRouter;
