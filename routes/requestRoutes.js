import express from "express";
import {
  createRequest,
  getRequests,
  getRequestById,
  acceptRequest,
  completeRequest,
  addRequestMessage,
  getRequestStats,
} from "../controllers/requestController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

const router = express.Router();

router.post(
  "/requests",
  requireHospitalContext,
  authorizeRoles("doctor"),
  createRequest
);

router.get(
  "/requests",
  authorizeRoles("hospitalAdmin", "doctor", "receptionist", "staff"),
  getRequests
);

router.get(
  "/requests/stats",
  authorizeRoles("hospitalAdmin", "doctor", "receptionist", "staff"),
  getRequestStats
);

router.get(
  "/requests/:requestId",
  authorizeRoles("hospitalAdmin", "doctor", "receptionist", "staff"),
  getRequestById
);

router.patch(
  "/requests/:requestId/accept",
  authorizeRoles("hospitalAdmin", "receptionist", "staff"),
  acceptRequest
);

router.patch(
  "/requests/:requestId/complete",
  authorizeRoles("hospitalAdmin", "receptionist", "staff"),
  completeRequest
);

router.post(
  "/requests/:requestId/messages",
  authorizeRoles("hospitalAdmin", "doctor", "receptionist", "staff"),
  addRequestMessage
);

export default router;
