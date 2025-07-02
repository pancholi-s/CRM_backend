import express from "express";

import { authorizeRoles } from '../middleware/roleMiddleware.js';
import { requireHospitalContext } from '../middleware/hospitalContext.js';

import { addStaff, getStaff , getStaffByDepartment} from '../controllers/staffController.js';

const router = express.Router();
router.use(requireHospitalContext);

router.post('/addStaff', authorizeRoles("hospitalAdmin"), addStaff);

router.get('/getStaff', authorizeRoles("receptionist", "hospitalAdmin",'doctor'), getStaff);

router.get(
  "/getStaffByDepartment/:departmentId",
  authorizeRoles("receptionist", "hospitalAdmin", "doctor"),
  getStaffByDepartment
);

export default router;
