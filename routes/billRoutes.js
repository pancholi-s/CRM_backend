import express from "express";
import { createBill, getAllBills, getBillDetails } from "../controllers/billController.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

const billRouter = express.Router();
billRouter.use(requireHospitalContext);

billRouter.post("/createBill", createBill);
billRouter.get("/getAllBills", getAllBills);
billRouter.get("/getBillDetails/:billId", getBillDetails);

export default billRouter;
