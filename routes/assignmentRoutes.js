import express from "express";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";
import { 
  createAssignment,
  getAssignments,
  updateAssignmentStatus,
  getDoctorAssignments,
  getStaffAssignments,
  getPatientAssignments
} from "../controllers/assignmentController.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/assignments", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  createAssignment
);

router.get("/assignments", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getAssignments
);

router.patch("/assignments/:assignmentId/status", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  updateAssignmentStatus
);

router.get("/assignments/doctor/:doctorId", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getDoctorAssignments
);

router.get("/assignments/staff/:staffId", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getStaffAssignments
);

router.get("/assignments/patient/:patientId", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getPatientAssignments
);

export default router;