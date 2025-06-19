import express from "express";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";
import { 
  validateAssignmentData,
  validateDoctorAssignment,
  validateStaffAssignment,
  validatePatientAssignment,
  validateAssignmentStatus
} from "../middleware/assignmentValidation.js";
import {
  mapAssignedByModel,
  prepareAssignmentData,
  buildAssignmentFilters,
  handlePagination
} from "../middleware/assignmentHelpers.js";
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
  validateAssignmentData,
  validateDoctorAssignment,
  validateStaffAssignment,
  validatePatientAssignment,
  mapAssignedByModel,
  prepareAssignmentData,
  createAssignment
);

router.get("/assignments", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  buildAssignmentFilters,
  handlePagination,
  getAssignments
);

router.patch("/assignments/:assignmentId/status", 
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  validateAssignmentStatus,
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