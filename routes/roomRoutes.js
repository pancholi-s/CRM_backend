import express from "express";

import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { requireHospitalContext } from "../middleware/hospitalContext.js";

import { addRoom, getRoomsByHospital } from '../controllers/roomController.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/addRoom', authorizeRoles("receptionist", "hospitalAdmin"), addRoom);
router.get('/getRoomsByHospital', authorizeRoles("receptionist", "hospitalAdmin"), getRoomsByHospital);

export default router;
