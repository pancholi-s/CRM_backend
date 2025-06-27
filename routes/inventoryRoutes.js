import express from "express";
import {
  createCategory,
  addInventoryItem,
  getInventoryByDepartment,
  getCategoriesByDepartment,
  getInventorySummary,
} from "../controllers/inventoryController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";

const router = express.Router();

router.post(
  "/inventory/categories",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "staff"),
  createCategory
);

router.post(
  "/inventory/items",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "staff"),
  addInventoryItem
);

router.get(
  "/inventory/:departmentId",
  authorizeRoles("hospitalAdmin", "doctor", "staff"),
  getInventoryByDepartment
);

router.get(
  "/inventory/categories/:departmentId",
  authorizeRoles("hospitalAdmin", "doctor", "staff"),
  getCategoriesByDepartment
);

router.get(
  "/inventory/summary/:departmentId",
  authorizeRoles("hospitalAdmin", "doctor", "staff"),
  getInventorySummary
);

export default router;
