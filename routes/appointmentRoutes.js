import express from 'express';
import { bookAppointment } from '../controllers/bookAppointmentController.js';
import { getAppointmentsByStatus, getFilteredAppointments } from '../controllers/getAppointmentController.js';

const router = express.Router();

// Route to book an appointment
router.post('/bookappointment', bookAppointment);

router.get('/getAppointmentsByStatus', getAppointmentsByStatus);
router.get('/getFilteredAppointments', getFilteredAppointments);

export default router;
