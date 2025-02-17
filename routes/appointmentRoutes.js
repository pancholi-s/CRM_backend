import express from 'express';
import { authorizeRoles } from "../middleware/roleMiddleware.js";

import { bookAppointment, completeAppointment, getAppointmentsByStatus, getFilteredAppointments, getAppointmentCounts, getRejectedAppointments, getAppointmentsByVisitType } from '../controllers/bookAppointmentController.js';
import { requireHospitalContext } from '../controllers/hospitalContext.js';
import { requestAppointment, approveAppointment, rejectAppointment,getRequestedAppointments } from '../controllers/requestedAppointmentController.js';
import { updateStatusesMiddleware } from '../middleware/statusMiddleware.js';

const router = express.Router();

router.use(requireHospitalContext);

router.post('/bookAppointment', authorizeRoles("receptionist"), bookAppointment); 
router.post('/completeAppointment', authorizeRoles("doctor"), completeAppointment);

router.post('/requestAppointment', authorizeRoles("patient"), requestAppointment);
router.post('/approveAppointment/:requestId', authorizeRoles("receptionist", "doctor"), approveAppointment);
router.post('/rejectAppointment/:requestId', authorizeRoles("receptionist", "doctor"), rejectAppointment);

router.get('/getAppointmentsByStatus', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getAppointmentsByStatus);
router.get('/getFilteredAppointments', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getFilteredAppointments);
router.get('/getAppointmentCounts', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getAppointmentCounts);
router.get('/getRejectedAppointments', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getRejectedAppointments);
router.get('/getAppointmentsByVisitType', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getAppointmentsByVisitType);
router.get('/getRequestedAppointments', authorizeRoles("receptionist", "hospitalAdmin"), updateStatusesMiddleware, getRequestedAppointments);

export default router;
