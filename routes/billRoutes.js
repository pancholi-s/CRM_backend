import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

import { createBill, getAllBills, getBillDetails, getRevenueByYear, getBillsByPatient, editBillDetails, addToBill, createEstimatedBill,getEstimatedBills, editEstimatedBill, addPayment, applyDiscount, refundBill } from "../controllers/billController.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/createBill", authorizeRoles("receptionist", "hospitalAdmin"), createBill);
router.post("/addToBill/:billId", authorizeRoles("receptionist", "hospitalAdmin"), addToBill);

router.get("/getAllBills", authorizeRoles("receptionist", "hospitalAdmin","doctor"), getAllBills);
router.get("/getBillsByPatient/:patientId", authorizeRoles("receptionist", "hospitalAdmin", "doctor"), getBillsByPatient);
router.get("/getBillDetails/:billId", authorizeRoles("receptionist", "hospitalAdmin", "doctor"), getBillDetails);
router.patch("/editBillDetails/:billId", authorizeRoles("receptionist", "hospitalAdmin", "doctor"), editBillDetails);
router.get("/getRevenueByYear", authorizeRoles("hospitalAdmin"), getRevenueByYear);

router.patch("/editBillDetails/:billId", authorizeRoles("receptionist", "hospitalAdmin", "doctor"), editBillDetails);

router.post("/createEstimatedBill", authorizeRoles("receptionist", "hospitalAdmin"), createEstimatedBill);
router.get("/getEstimatedBills/:admissionRequestId", authorizeRoles("receptionist", "hospitalAdmin","doctor"), getEstimatedBills);
router.put("/editEstimatedBill/:estimateId", editEstimatedBill);

router.post("/addPayment/:billId", authorizeRoles("receptionist", "hospitalAdmin"), addPayment);
router.post("/applyDiscount/:billId", authorizeRoles("receptionist", "hospitalAdmin"), applyDiscount);
router.post("/refundBill/:billId", authorizeRoles("receptionist", "hospitalAdmin"), refundBill);

export default router;
