import express from 'express';
import { bookAppointment } from '../controllers/bookAppointmentController.js';
import { getAppointmentsByStatus, getFilteredAppointments } from '../controllers/getAppointmentController.js';
import { requireHospitalContext } from '../controllers/hospitalContext.js';
import { requestAppointment, approveAppointment, rejectAppointment } from '../controllers/requestedAppointmentController.js';

const router = express.Router();

router.use(requireHospitalContext);

// Route to book an appointment
router.post('/bookappointment', bookAppointment);

router.post('/requestAppointment', requestAppointment);
router.post('/approveAppointment/:requestId', approveAppointment);
router.post('/rejectAppointment/:requestId', rejectAppointment);

router.get('/getAppointmentsByStatus', getAppointmentsByStatus);
router.get('/getFilteredAppointments', getFilteredAppointments);

export default router;
