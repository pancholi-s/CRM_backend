import express from "express";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";
import { createEvent, getEvents } from "../controllers/eventController.js";

const router = express.Router();

router.use(requireHospitalContext);

router.post(
  "/create",
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  createEvent
);

router.get(
  "/",
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  getEvents
);

export default router;
