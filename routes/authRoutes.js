import express from 'express';
import { loginUser, registerUser } from '../controllers/controller.js';

const router = express.Router();

router.post('/register', registerUser);

// Common login route for all roles
router.post('/login', loginUser);

export default router;