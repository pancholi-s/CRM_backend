import express from "express";
import {
  createCategory,
  addInventoryItem,
  getInventoryByDepartment,
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

export default router;
