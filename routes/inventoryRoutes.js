import express from "express";
import {
  createCategory,
  addInventoryItem,
  updateInventoryItem,
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

router.patch(
  "/inventory/items/:itemId",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "staff"),
  updateInventoryItem
);

router.get(
  "/inventory/:departmentId",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "staff"),
  getInventoryByDepartment
);

router.get(
  "/inventory/categories/:departmentId",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "staff"),
  getCategoriesByDepartment
);

router.get(
  "/inventory/summary/:departmentId",
  requireHospitalContext,
  authorizeRoles("hospitalAdmin", "doctor", "staff"),
  getInventorySummary
);

export default router;
