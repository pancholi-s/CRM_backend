import express from 'express';
import { addReceptionist, getReceptionists, loginReceptionist } from '../controllers/receptionistController.js';

const router = express.Router();

// Route to add a new receptionist
router.post('/add', addReceptionist);

// Route to retrieve all receptionists
router.get('/', getReceptionists);

// Route for receptionist login
router.post('/login', loginReceptionist); // Add this line

export default router;
