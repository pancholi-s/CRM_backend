import express from "express";
import {
  getYearlyTPAReport,
  getMonthlyTPAReport,
  earningsOverviewReport,
  roomBedReport
} from "../controllers/tpaReportController.js";

const router = express.Router();

router.get("/tpa/yearly", getYearlyTPAReport);
router.get("/tpa/monthly", getMonthlyTPAReport);
router.get("/earningsOverviewReport", earningsOverviewReport);
router.get("/roomBedReport", roomBedReport);

export default router;
