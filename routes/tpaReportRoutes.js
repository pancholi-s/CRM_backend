import express from "express";
import {
  getYearlyTPAReport,
  getMonthlyTPAReport
} from "../controllers/tpaReportController.js";

const router = express.Router();

router.get("/tpa/yearly", getYearlyTPAReport);
router.get("/tpa/monthly", getMonthlyTPAReport);

export default router;
