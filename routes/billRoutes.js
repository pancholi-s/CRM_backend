import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

import { createBill, getAllBills, getBillDetails, getRevenueByYear } from "../controllers/billController.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/createBill", authorizeRoles("receptionist", "hospitalAdmin"), createBill);

router.get("/getAllBills", authorizeRoles("receptionist", "hospitalAdmin"), getAllBills);
router.get("/getBillDetails/:billId", authorizeRoles("receptionist", "hospitalAdmin"), getBillDetails);
router.get("/getRevenueByYear", authorizeRoles("hospitalAdmin"), getRevenueByYear);

export default router;
