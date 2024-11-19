import express from 'express';
import { addDepartment, getDepartments, getAllDepartments } from '../controllers/departmentController.js';

const router = express.Router();

router.post('/addDepartments', addDepartment);

router.get('/getDepartments/:departmentId', getDepartments); // Assuming you fetch by ID
router.get('/getAllDepartments', getAllDepartments);

export default router;