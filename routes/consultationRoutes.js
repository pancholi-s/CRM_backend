import express from 'express';

import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { requireHospitalContext } from '../middleware/hospitalContext.js';
import { createConsultation, getConsultationByAppointment,getPatientConsultationHistory } from '../controllers/consultationController.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/createConsultation', authorizeRoles('doctor'), createConsultation);
router.get('/getConsultationByAppointment/:appointmentId', authorizeRoles('doctor', 'receptionist', 'hospitalAdmin'), getConsultationByAppointment);
router.get('/getPatientConsultationHistory/:patientId', authorizeRoles('doctor', 'hospitalAdmin'), getPatientConsultationHistory);

export default router;
