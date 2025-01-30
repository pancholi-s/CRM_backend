import express from 'express';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

import { getReceptionists } from '../controllers/receptionistController.js';

const router = express.Router();

// Route to retrieve all receptionists
router.get('/getReceptionists', authorizeRoles("receptionist", "hospitalAdmin"), getReceptionists);

export default router;
