import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

import { addDepartment, getDepartments, getAllDepartments } from '../controllers/departmentController.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/addDepartments', authorizeRoles("hospitalAdmin"), addDepartment);

router.get('/getDepartments/:departmentId', authorizeRoles("receptionist", "hospitalAdmin",'doctor'), getDepartments); 
router.get('/getAllDepartments', authorizeRoles("receptionist", "hospitalAdmin",'doctor'), getAllDepartments);

export default router;