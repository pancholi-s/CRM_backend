import express from 'express';
import { getReceptionists } from '../controllers/receptionistController.js';

const router = express.Router();

// Route to retrieve all receptionists
router.get('/', getReceptionists);

export default router;
