import express from 'express';

import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { requireHospitalContext } from '../middleware/hospitalContext.js';
import { submitConsultation, getConsultationByAppointment,getPatientConsultationHistory,getMostCommonDiagnoses, getProgressTracker, addProgressPhase, updateConsultation, updatePhase, getProgressPhaseCounts } from '../controllers/consultationController.js';


const router = express.Router();
router.use(requireHospitalContext);

router.post('/submitConsultation', authorizeRoles('doctor'), submitConsultation);
router.post('/addProgressPhase', authorizeRoles('doctor'), addProgressPhase);
router.get('/getProgressTracker/:patientId/:caseId', authorizeRoles('doctor', 'receptionist'), getProgressTracker);
router.get('/getProgressPhaseCounts', authorizeRoles('doctor'), getProgressPhaseCounts);
router.get('/getConsultationByAppointment/:appointmentId', authorizeRoles('doctor', 'receptionist', 'hospitalAdmin'), getConsultationByAppointment);
router.get('/getPatientConsultationHistory/:patientId', authorizeRoles('doctor', 'hospitalAdmin'), getPatientConsultationHistory);
router.get('/diagnosis/most-common', authorizeRoles('hospitalAdmin', 'doctor', 'receptionist'), getMostCommonDiagnoses);
router.put('/updateConsultation/:consultationId', authorizeRoles('doctor'), updateConsultation);
router.put('/updatePhase/:sourceType/:sourceId', authorizeRoles('doctor'), updatePhase);

export default router;
