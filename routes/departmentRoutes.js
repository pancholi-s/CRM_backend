import express from 'express';
import { addDepartment, getDepartments } from '../controllers/departmentController.js';

const router = express.Router();

router.post('/addDepartments', addDepartment);

// Common login route for all roles
router.get('/getDepartments', getDepartments);

export default router;