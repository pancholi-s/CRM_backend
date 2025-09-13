import express from "express";
import upload from "../middleware/fileUpload.js";
import {
  uploadFiles,
  getAllFiles,
  getFileById,
  getFilesByPatient,
  deleteFile,
} from "../controllers/patientFileController.js";

import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

const router = express.Router();

// Upload files for a specific patient
router.post(
  "/upload",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  upload.array("files", 5),
  uploadFiles
);

// Get all files in hospital
router.get(
  "/files",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  getAllFiles
);

// Get files by specific patient
router.get(
  "/files/patient/:patientId",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  getFilesByPatient
);

// Get single file by ID
router.get(
  "/files/:id",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  getFileById
);

router.delete(
  "/files/:id",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "receptionist", "doctor"),
  deleteFile
);

export default router;
