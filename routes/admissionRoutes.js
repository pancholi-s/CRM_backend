import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from '../middleware/hospitalContext.js';
import { updateStatusesMiddleware } from '../middleware/statusMiddleware.js';
import { paginationMiddleware } from '../middleware/paginationMiddleware.js';

import { createAdmissionRequest, approveAdmissionRequest, admitPatient, getAdmissionRequests, getApprovedAdmissions, getAdmittedPatients} from '../controllers/admissionRequest.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/createAdmissionRequest',authorizeRoles("hospitalAdmin","doctor"), createAdmissionRequest);
router.put('/approveAdmissionRequest/:requestId', authorizeRoles("hospitalAdmin","doctor"),approveAdmissionRequest);
router.post('/admitPatient/:requestId', admitPatient);
router.get('/admissionRequests', getAdmissionRequests);
router.get('/approvedAdmissions', getApprovedAdmissions);
router.get('/admittedPatients', getAdmittedPatients);


export default router;