import express from 'express';
import { bookAppointment, completeAppointment, getAppointmentsByStatus, getFilteredAppointments, getAppointmentCounts, getRejectedAppointments, getAppointmentsByVisitType } from '../controllers/bookAppointmentController.js';
import { requireHospitalContext } from '../controllers/hospitalContext.js';
import { requestAppointment, approveAppointment, rejectAppointment,getRequestedAppointments } from '../controllers/requestedAppointmentController.js';
import { updateStatusesMiddleware } from '../middleware/statusMiddleware.js';

const router = express.Router();

router.use(requireHospitalContext);

router.post('/bookAppointment', bookAppointment); 
router.post('/completeAppointment', completeAppointment);

router.post('/requestAppointment', requestAppointment);
router.post('/approveAppointment/:requestId', approveAppointment);
router.post('/rejectAppointment/:requestId', rejectAppointment);

router.get('/getAppointmentsByStatus', updateStatusesMiddleware, getAppointmentsByStatus);
router.get('/getFilteredAppointments', updateStatusesMiddleware, getFilteredAppointments);
router.get('/getAppointmentCounts', updateStatusesMiddleware, getAppointmentCounts);
router.get('/getRejectedAppointments', updateStatusesMiddleware, getRejectedAppointments);
router.get('/getAppointmentsByVisitType', updateStatusesMiddleware, getAppointmentsByVisitType);
router.get('/getRequestedAppointments', updateStatusesMiddleware, getRequestedAppointments);

export default router;
