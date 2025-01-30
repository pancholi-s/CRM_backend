import express from 'express';
import { authorizeRoles } from '../middleware/roleMiddleware.js';

import { addStaff, getStaff } from '../controllers/staffController.js';
import { requireHospitalContext } from '../controllers/hospitalContext.js';

const router = express.Router();

router.use(requireHospitalContext);

router.post('/addStaff', authorizeRoles("hospitalAdmin"), addStaff);
router.get('/getStaff', authorizeRoles("receptionist", "hospitalAdmin"), getStaff);

export default router;
