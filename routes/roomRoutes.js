import express from "express";

import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { requireHospitalContext } from "../middleware/hospitalContext.js";

import { addRoom, getRoomsByHospital,  getRoomById,  updateRoom, getAllRooms } from '../controllers/roomController.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/addRoom', authorizeRoles("receptionist", "hospitalAdmin", "doctor"), addRoom);
router.get('/getRoomsByHospital', authorizeRoles("receptionist", "hospitalAdmin", "doctor"), getRoomsByHospital);

router.get('/getAllRooms', authorizeRoles("receptionist", "hospitalAdmin", "doctor"), getAllRooms);

router.get('/getRoom/:roomId', authorizeRoles("receptionist", "hospitalAdmin", "doctor"), getRoomById);
router.patch('/updateRoom/:roomId', authorizeRoles("receptionist", "hospitalAdmin", "doctor"), updateRoom);

export default router;
