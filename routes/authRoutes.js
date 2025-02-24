import express from 'express';
import { requireHospitalContext } from '../controllers/hospitalContext.js';

import { loginUser, registerUser } from '../controllers/controller.js';
import { registerHospital } from '../controllers/hospitalController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

router.post('/registerHospital', registerHospital);

router.use( requireHospitalContext );     // Apply globally or to specific routes

export default router;