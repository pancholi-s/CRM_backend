import express from "express";
import { requireHospitalContext } from '../middleware/hospitalContext.js';
import upload from "../middleware/fileUpload.js";
import { loginUser, registerUser, forgotPassword, resetPassword } from '../controllers/authController.js';
import { registerHospital, addHospitalImage } from '../controllers/hospitalController.js';

const router = express.Router();

router.post('/register', registerUser);
router.post('/login', loginUser);

router.post("/forgotPassword", forgotPassword);
router.post("/resetPassword", resetPassword);

router.post('/registerHospital', registerHospital);
router.post("/addHospitalImage", upload.single("image"), addHospitalImage);

router.use( requireHospitalContext );     // Apply globally or to specific routes

export default router;