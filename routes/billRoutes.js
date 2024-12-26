import express from "express";
import { createBill, getBillDetails } from "../controllers/billController.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

const billRouter = express.Router();
billRouter.use(requireHospitalContext);

billRouter.post("/createBill", createBill);
billRouter.get("/getBillDetails/:billId", getBillDetails);

export default billRouter;
