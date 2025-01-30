import express from 'express';
import { authorizeRoles } from "../middleware/roleMiddleware.js";

import { addExpense, getExpenses } from '../controllers/expenseController.js';
import { requireHospitalContext } from '../controllers/hospitalContext.js';

const router = express.Router();
router.use(requireHospitalContext);

router.get('/getExpenses', authorizeRoles("hospitalAdmin"), getExpenses);
router.post('/addExpense', authorizeRoles("hospitalAdmin"), addExpense);

export default router;
