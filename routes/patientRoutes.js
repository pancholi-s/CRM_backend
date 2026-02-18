import express from "express";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";
import { paginationMiddleware } from "../middleware/paginationMiddleware.js";

import { getPatientsByHospital, getPatientsByStatus,getAppointmentsByPatientId, getPatientDetailsById,getInpatients, getPatientsInSurgery,updateHealthStatus , getActivePatientCount, getPatientDetailsbyPatId,getMostCommonDiagnosis, getTop4Procedures, getCriticalPatients  } from "../controllers/patientController.js"
import { getAdmissionDetails, searchPatientByPatId } from "../controllers/patientController.js";

const router = express.Router();
router.use(requireHospitalContext);

router.post("/updateHealthStatus/:patientId", authorizeRoles("doctor", "hospitalAdmin",'staff'), updateHealthStatus)
router.get("/getPatientsByHospital", authorizeRoles("receptionist", "hospitalAdmin", "doctor"), getPatientsByHospital,paginationMiddleware)
router.get("/getPatientDetailsbyPatId/:patientId", authorizeRoles("receptionist", "hospitalAdmin", "doctor"), getPatientDetailsbyPatId)
router.get("/getPatientsByStatus", authorizeRoles("receptionist", "hospitalAdmin","doctor"), getPatientsByStatus ,paginationMiddleware);
router.post(
  "/updateHealthStatus/:patientId",
  authorizeRoles("doctor", "hospitalAdmin"),
  updateHealthStatus,
  updateHealthStatus
);
router.get(
  "/getPatientsByHospital",
  authorizeRoles("receptionist", "hospitalAdmin", "doctor","staff"),
  getPatientsByHospital,
  paginationMiddleware
);
router.get(
  "/getPatientsByStatus",
  authorizeRoles("receptionist", "hospitalAdmin", "doctor","staff"),
  getPatientsByStatus,
  paginationMiddleware
);
router.get(
  "/:patientId/appointments",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin","staff"),
  getAppointmentsByPatientId
);
router.get(
  "/:patientId/details",
  authorizeRoles("receptionist", "hospitalAdmin", "doctor","staff"),
  getPatientDetailsById
);

router.get(
  "/getInpatients",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin","staff"),
  getInpatients,
  paginationMiddleware
);

router.get(
  "/getpatientsinsurgery",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin","staff"),
  getPatientsInSurgery,
  paginationMiddleware
);

router.get(
  "/count/active",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin","staff"),
  getActivePatientCount
);

router.get(
  "/getCriticalPatients",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin","staff"),
  getCriticalPatients
);
router.get(
  "/getTop4Procedures",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin","staff"),
  getTop4Procedures
);
router.get(
  "/getMostCommonDiagnosis",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin","staff"),
  getMostCommonDiagnosis
);

router.get(
  "/admission/:admissionId",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin","staff"),
  getAdmissionDetails
);

router.get(
  "/search/patid",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin","staff"),
  searchPatientByPatId
);

export default router;
