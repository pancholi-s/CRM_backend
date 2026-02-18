import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

import { createBill, getAllBills, getBillDetails, getRevenueByYear, getBillsByPatient, editBillDetails, addToBill, createEstimatedBill, getEstimatedBills, editEstimatedBill, addPayment, applyDiscount, refundBill, deleteBillServiceEntry } from "../controllers/billController.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/createBill", authorizeRoles("receptionist", "hospitalAdmin",'staff'), createBill);
router.post("/addToBill/:billId", authorizeRoles("receptionist", "hospitalAdmin",'staff'), addToBill);

router.get("/getAllBills", authorizeRoles("receptionist", "hospitalAdmin", "doctor",'staff'), getAllBills);
router.get("/getBillsByPatient/:patientId", authorizeRoles("receptionist", "hospitalAdmin", "doctor",'staff'), getBillsByPatient);
router.get("/getBillDetails/:billId", authorizeRoles("receptionist", "hospitalAdmin", "doctor",'staff'), getBillDetails);
router.patch("/editBillDetails/:billId", authorizeRoles("receptionist", "hospitalAdmin", "doctor",'staff'), editBillDetails);
router.get("/getRevenueByYear", authorizeRoles("hospitalAdmin"), getRevenueByYear);

router.patch("/editBillDetails/:billId", authorizeRoles("receptionist", "hospitalAdmin", "doctor",'staff'), editBillDetails);

router.post("/createEstimatedBill", authorizeRoles("receptionist", "hospitalAdmin",'staff'), createEstimatedBill);
router.get("/getEstimatedBills/:admissionRequestId", authorizeRoles("receptionist", "hospitalAdmin", "doctor",'staff'), getEstimatedBills);
router.put("/editEstimatedBill/:estimateId", editEstimatedBill);

router.post("/addPayment/:billId", authorizeRoles("receptionist", "hospitalAdmin",'staff'), addPayment);
router.post("/applyDiscount/:billId", authorizeRoles("receptionist", "hospitalAdmin",'staff'), applyDiscount);
router.post("/refundBill/:billId", authorizeRoles("receptionist", "hospitalAdmin",'staff'), refundBill);

router.delete("/deleteBillServiceEntry/:billId/services/:serviceEntryId", authorizeRoles("receptionist", "hospitalAdmin",'staff'), deleteBillServiceEntry);


export default router;
