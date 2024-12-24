import express from 'express';
import {
  addStaff,
  getStaff,
  updateStaff,
  deleteStaff,
} from '../controllers/staffController.js';
import { requireHospitalContext } from '../controllers/hospitalContext.js';

const router = express.Router();

// Middleware to enforce hospital context
router.use(requireHospitalContext);

router.post('/addStaff', addStaff);
router.get('/getStaff', getStaff);
router.put('/updateStaff/:id', updateStaff);
router.delete('/deleteStaff/:id', deleteStaff);

export default router;
