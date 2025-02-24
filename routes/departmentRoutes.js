import express from 'express';
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../controllers/hospitalContext.js";

import { addDepartment, getDepartments, getAllDepartments } from '../controllers/departmentController.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/addDepartments', authorizeRoles("hospitalAdmin"), addDepartment);

router.get('/getDepartments/:departmentId', authorizeRoles("receptionist", "hospitalAdmin"), getDepartments); 
router.get('/getAllDepartments', authorizeRoles("receptionist", "hospitalAdmin"), getAllDepartments);

export default router;