import express from "express";

import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { requireHospitalContext } from '../middleware/hospitalContext.js';

import { getReceptionists } from '../controllers/receptionistController.js';

const router = express.Router();
router.use(requireHospitalContext);

router.get('/getReceptionists', authorizeRoles("receptionist", "hospitalAdmin"), getReceptionists);

export default router;
