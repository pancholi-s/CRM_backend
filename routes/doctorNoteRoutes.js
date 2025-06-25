import express from 'express';
import { createDoctorNote, getDoctorNotes } from '../controllers/doctorNoteController.js';
import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { requireHospitalContext } from '../middleware/hospitalContext.js';

const router = express.Router();

router.post(
  '/doctor-notes',
  requireHospitalContext,
  authorizeRoles('doctor'),
  createDoctorNote
);

router.get(
  '/doctor-notes',
  authorizeRoles('hospitalAdmin', 'doctor', 'receptionist'),
  getDoctorNotes
);

export default router; 
