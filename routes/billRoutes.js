import express from "express";
import { createBill, getAllBills, getBillDetails } from "../controllers/billController.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/createBill", createBill);
router.get("/getAllBills", getAllBills);
router.get("/getBillDetails/:billId", getBillDetails);

export default router;
