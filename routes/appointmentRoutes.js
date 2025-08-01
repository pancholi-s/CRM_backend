import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from '../middleware/hospitalContext.js';
import { updateStatusesMiddleware } from '../middleware/statusMiddleware.js';
import { paginationMiddleware } from '../middleware/paginationMiddleware.js';

import { bookAppointment, completeAppointment, getAppointmentsByStatus, getFilteredAppointments, getAppointmentCounts, getRejectedAppointments, getCancelledAppointments, getAppointmentsByVisitType, getAppointments,getAppointmentHistory } from '../controllers/bookAppointmentController.js';
import { requestAppointment, getRequestedAppointments, approveAppointment, rejectAppointment, cancelAppointment } from '../controllers/requestedAppointmentController.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/bookAppointment', authorizeRoles("receptionist"), bookAppointment); 
router.post('/completeAppointment', authorizeRoles("doctor"), completeAppointment);

router.post('/requestAppointment', authorizeRoles("patient"), requestAppointment);
router.post('/approveAppointment/:requestId', authorizeRoles("receptionist", "doctor"), approveAppointment);
router.post('/rejectAppointment/:requestId', authorizeRoles("receptionist", "doctor"), rejectAppointment);
router.post('/cancelAppointment/:appointmentId', authorizeRoles("receptionist", "patient"), cancelAppointment);

router.get('/getAppointmentsByStatus', authorizeRoles("receptionist", "hospitalAdmin","doctor"), updateStatusesMiddleware, getAppointmentsByStatus, paginationMiddleware);
router.get('/getFilteredAppointments', authorizeRoles("receptionist", "hospitalAdmin","doctor"), updateStatusesMiddleware, getFilteredAppointments, paginationMiddleware);
router.get('/getAppointmentCounts', authorizeRoles("receptionist", "hospitalAdmin","doctor"), updateStatusesMiddleware, getAppointmentCounts);
router.get('/getRejectedAppointments', authorizeRoles("receptionist", "hospitalAdmin","doctor"), updateStatusesMiddleware, getRejectedAppointments);
router.get('/getAppointmentsByVisitType', authorizeRoles("receptionist", "hospitalAdmin","doctor"), updateStatusesMiddleware, getAppointmentsByVisitType, paginationMiddleware);
router.get('/getRequestedAppointments', authorizeRoles("receptionist", "hospitalAdmin","doctor"), updateStatusesMiddleware, getRequestedAppointments);
router.get('/getCancelledAppointments', authorizeRoles("receptionist", "hospitalAdmin","doctor"), updateStatusesMiddleware, getCancelledAppointments);
router.get('/getAppointments', authorizeRoles("receptionist", "hospitalAdmin","doctor"), updateStatusesMiddleware, getAppointments);
router.get('/getAppointmentsHistory', authorizeRoles("receptionist", "hospitalAdmin","doctor"), getAppointmentHistory);

export default router;
