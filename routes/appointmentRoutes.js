import express from 'express';
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from '../controllers/hospitalContext.js';
import { updateStatusesMiddleware } from '../middleware/statusMiddleware.js';

import { bookAppointment, completeAppointment, getAppointmentsByStatus, getFilteredAppointments, getAppointmentCounts, getRejectedAppointments, getCancelledAppointments, getAppointmentsByVisitType, assignTokenNumber } from '../controllers/bookAppointmentController.js';
import { requestAppointment, getRequestedAppointments, approveAppointment, rejectAppointment, cancelAppointment } from '../controllers/requestedAppointmentController.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/bookAppointment', authorizeRoles("receptionist"), bookAppointment); 
router.post('/completeAppointment', authorizeRoles("doctor"), completeAppointment);

router.post('/requestAppointment', authorizeRoles("patient"), requestAppointment);
router.post('/approveAppointment/:requestId', authorizeRoles("receptionist", "doctor"), approveAppointment);
router.post('/rejectAppointment/:requestId', authorizeRoles("receptionist", "doctor"), rejectAppointment);
router.post('/cancelAppointment/:appointmentId', authorizeRoles("receptionist", "patient"), cancelAppointment);
router.post('/assignTokenNumber/:appointmentId', authorizeRoles("receptionist"), assignTokenNumber);

router.get('/getAppointmentsByStatus', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getAppointmentsByStatus);
router.get('/getFilteredAppointments', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getFilteredAppointments);
router.get('/getAppointmentCounts', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getAppointmentCounts);
router.get('/getRejectedAppointments', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getRejectedAppointments);
router.get('/getAppointmentsByVisitType', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getAppointmentsByVisitType);
router.get('/getRequestedAppointments', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getRequestedAppointments);
router.get('/getCancelledAppointments', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getCancelledAppointments);

export default router;
