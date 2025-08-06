import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

import { createBill, getAllBills, getBillDetails, getRevenueByYear, getBillsByPatient, editBillDetails, addToBill } from "../controllers/billController.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/createBill", authorizeRoles("receptionist", "hospitalAdmin"), createBill);
router.post("/addToBill/:billId", authorizeRoles("receptionist", "hospitalAdmin"), addToBill);

router.get("/getAllBills", authorizeRoles("receptionist", "hospitalAdmin","doctor"), getAllBills);
router.get("/getBillsByPatient/:patientId", authorizeRoles("receptionist", "hospitalAdmin", "doctor"), getBillsByPatient);
router.get("/getBillDetails/:billId", authorizeRoles("receptionist", "hospitalAdmin", "doctor"), getBillDetails);
router.put("/editBillDetails/:billId", authorizeRoles("receptionist", "hospitalAdmin", "doctor"), editBillDetails);
router.get("/getRevenueByYear", authorizeRoles("hospitalAdmin"), getRevenueByYear);

export default router;
