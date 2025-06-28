import express from "express";
import {
  createEvent,
  getEvents,
  getEventById,
  updateEvent,
  deleteEvent,
  getEventStats
} from "../controllers/eventController.js";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

const router = express.Router();

router.post(
  "/events",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  createEvent
);

router.get(
  "/events",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  getEvents
);

router.get(
  "/events/stats",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  getEventStats
);

router.get(
  "/events/:id",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  getEventById
);

router.patch(
  "/events/:id",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  updateEvent
);

router.delete(
  "/events/:id",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  deleteEvent
);

export default router;
