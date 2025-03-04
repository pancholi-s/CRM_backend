import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from '../middleware/hospitalContext.js';

import { addExpense, getExpenses } from '../controllers/expenseController.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/addExpense', authorizeRoles("hospitalAdmin"), addExpense);

router.get('/getExpenses', authorizeRoles("hospitalAdmin"), getExpenses);

export default router;
