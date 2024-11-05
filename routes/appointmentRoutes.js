import express from 'express';
import { bookAppointment } from '../controllers/bookAppointmentController.js';
import {
  getScheduledAppointments,
  getOngoingAppointments,
  getWaitingAppointments,
  getCompletedAppointments,
} from '../controllers/getAppointmentController.js';

const router = express.Router();

// Route to book an appointment
router.post('/bookappointment', bookAppointment);

router.get('/getScheduledAppointments', getScheduledAppointments);
router.get('/getOngoingAppointments', getOngoingAppointments);
router.get('/getWaitingAppointments', getWaitingAppointments);
router.get('/getCompletedAppointments', getCompletedAppointments);

export default router;
