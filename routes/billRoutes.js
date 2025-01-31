import express from "express";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

import { createBill, getAllBills, getBillDetails } from "../controllers/billController.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/createBill", authorizeRoles("receptionist", "hospitalAdmin"), createBill);
router.get("/getAllBills", authorizeRoles("receptionist", "hospitalAdmin"), getAllBills);
router.get("/getBillDetails/:billId", authorizeRoles("receptionist", "hospitalAdmin"), getBillDetails);

export default router;
