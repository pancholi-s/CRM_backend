import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from '../middleware/hospitalContext.js';
import { updateStatusesMiddleware } from '../middleware/statusMiddleware.js';
import { paginationMiddleware } from '../middleware/paginationMiddleware.js';

import { createAdmissionRequest, approveAdmissionRequest, admitPatient, getAdmissionRequests, getApprovedAdmissions, getAdmittedPatients, getAdmissionRequestsWithInsurance , updateInsuranceStatus , dischargePatient, downloadDischargePDF, addInsuranceAfterAdmission, getAdmissionRequestsAll} from '../controllers/admissionRequest.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/createAdmissionRequest',authorizeRoles("hospitalAdmin","doctor"), createAdmissionRequest);
router.post('/dischargePatient',authorizeRoles("hospitalAdmin","doctor"), dischargePatient);
router.get('/discharge/:dischargeId/download-pdf', 
  authorizeRoles("hospitalAdmin","doctor","receptionist"), 
  downloadDischargePDF
);
router.put('/approveAdmissionRequest/:requestId', authorizeRoles("hospitalAdmin","doctor"),approveAdmissionRequest);
router.post('/admitPatient/:requestId', admitPatient);
router.get('/getAdmissionRequests', getAdmissionRequests);
router.get('/approvedAdmissions', getApprovedAdmissions);
router.get('/admittedPatients', getAdmittedPatients);
router.get('/getAdmissionRequestsWithInsurance', getAdmissionRequestsWithInsurance);
router.get('/getAdmissionRequestsAll', getAdmissionRequestsAll);

router.put('/updateInsuranceStatus/:admissionId', updateInsuranceStatus);
router.patch('/addInsuranceAfterAdmission/:admissionId', addInsuranceAfterAdmission);


export default router;