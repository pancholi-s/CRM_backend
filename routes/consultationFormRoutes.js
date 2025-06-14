import express from "express";
import {
  createConsultationForm,
  getConsultationForms,
  getConsultationFormById,
  updateConsultationForm,
  deleteConsultationForm
} from "../controllers/consultationFormController.js";

import { requireHospitalContext } from "../middleware/hospitalContext.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.use(requireHospitalContext);

router.post(
  "/consultationForms",
  authorizeRoles("doctor"),
  createConsultationForm
);

router.get(
  "/consultationForms",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getConsultationForms
);

router.get(
  "/consultationForms/:id",
  authorizeRoles("doctor", "receptionist", "hospitalAdmin"),
  getConsultationFormById
);

router.patch(
  "/consultationForms/:id",
  authorizeRoles("doctor"),
  updateConsultationForm
);

router.delete(
  "/consultationForms/:id",
  authorizeRoles("doctor", "hospitalAdmin"),
  deleteConsultationForm
);

export default router;
