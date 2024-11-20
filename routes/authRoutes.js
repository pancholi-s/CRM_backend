import express from 'express';
import { loginUser, registerUser } from '../controllers/controller.js';
import { registerHospital } from '../controllers/hospitalController.js';

const router = express.Router();

router.post('/register', registerUser);

// Common login route for all roles
router.post('/login', loginUser);

//register a hospital
router.post('/registerHospital', registerHospital);

export default router;