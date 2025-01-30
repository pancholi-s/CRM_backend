import express from 'express';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

import { addRoom, getRooms } from '../controllers/roomController.js';

const router = express.Router();

router.post('/addRoom', authorizeRoles("hospitalAdmin"), addRoom);

// Get rooms (with optional filtering by hospital and department)
router.get('/getRooms', authorizeRoles("receptionist", "hospitalAdmin"), getRooms);

export default router;
