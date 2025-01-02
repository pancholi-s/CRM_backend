import express from 'express';
import { addExpense, getExpenses } from '../controllers/expenseController.js';
import { requireHospitalContext } from '../controllers/hospitalContext.js';

const router = express.Router();

router.use(requireHospitalContext);

router.post('/addExpense', addExpense);
router.get('/getExpenses', getExpenses);

export default router;
