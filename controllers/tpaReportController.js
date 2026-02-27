import mongoose from "mongoose";
import AdmissionRequest from "../models/admissionReqModel.js";
import Bill from "../models/billModel.js";
import Room from "../models/roomModel.js";
import Bed from "../models/bedModel.js";

const MONTH_NAMES = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

/**
 * Unified aggregation builder
 */
const buildTPAAggregation = ({
  hospitalId,
  startDate,
  endDate,
  groupByMonth,
  company
}) => {
  const matchStage = {
    hospital: new mongoose.Types.ObjectId(hospitalId),
    createdAt: { $gte: startDate, $lte: endDate },
    "admissionDetails.insurance.insuranceCompany": { $exists: true, $ne: null }
  };

  if (company) {
    matchStage["admissionDetails.insurance.insuranceCompany"] = company;
  }

  return [
    { $match: matchStage },

    {
      $lookup: {
        from: "bills",
        localField: "caseId",
        foreignField: "caseId",
        as: "bill"
      }
    },

    {
      $addFields: {
        billAmount: {
          $ifNull: [{ $arrayElemAt: ["$bill.totalAmount", 0] }, 0]
        },
        paidAmount: {
          $ifNull: [{ $arrayElemAt: ["$bill.paidAmount", 0] }, 0]
        },
        outstandingAmount: {
          $ifNull: [{ $arrayElemAt: ["$bill.outstanding", 0] }, 0]
        },
        approvedAmountRaw: {
          $ifNull: ["$admissionDetails.insurance.amountApproved", 0]
        },
        status: "$admissionDetails.insurance.insuranceApproved",
        company: "$admissionDetails.insurance.insuranceCompany",
        month: { $month: "$createdAt" }
      }
    },

    // Prevent over-approval errors
    {
      $addFields: {
        approvedAmount: {
          $min: ["$approvedAmountRaw", "$billAmount"]
        }
      }
    },

    {
      $group: {
        _id: {
          company: "$company",
          ...(groupByMonth ? { month: "$month" } : {})
        },

        // ---- COUNTS ----
        totalCases: { $sum: 1 },
        acceptedCases: {
          $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] }
        },
        rejectedCases: {
          $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] }
        },
        pendingCases: {
          $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] }
        },

        // ---- AMOUNTS ----
        totalClaimedAmount: { $sum: "$billAmount" },

        acceptedAmount: {
          $sum: {
            $cond: [
              { $eq: ["$status", "approved"] },
              "$approvedAmount",
              0
            ]
          }
        },

        rejectedAmount: {
          $sum: {
            $cond: [
              { $eq: ["$status", "rejected"] },
              "$billAmount",
              0
            ]
          }
        },

        pendingAmount: {
          $sum: {
            $cond: [
              { $eq: ["$status", "pending"] },
              "$billAmount",
              0
            ]
          }
        },

        // ---- PAYMENT DIMENSION ----
        recoveredAmount: { $sum: "$paidAmount" },
        remainingAmount: { $sum: "$outstandingAmount" }
      }
    },

    { $sort: { "_id.company": 1, "_id.month": 1 } }
  ];
};


export const getYearlyTPAReport = async (req, res) => {
  try {
    const {
      year,
      company,
      startDate: customStart,
      endDate: customEnd
    } = req.query;

    const { hospitalId } = req.session;

    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context." });
    }

    let startDate, endDate;
    let targetYear;

    // ✅ If custom date range is provided
    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      targetYear = new Date(startDate).getFullYear();
    } else {
      targetYear = parseInt(year) || new Date().getFullYear();
      startDate = new Date(`${targetYear}-01-01T00:00:00.000Z`);
      endDate = new Date(`${targetYear}-12-31T23:59:59.999Z`);
    }

    const data = await AdmissionRequest.aggregate(
      buildTPAAggregation({
        hospitalId,
        startDate,
        endDate,
        groupByMonth: true,
        company
      })
    );

    const response = {
      year: targetYear,
      overall: {
        totalCases: 0,
        acceptedCases: 0,
        rejectedCases: 0,
        pendingCases: 0,
        totalClaimedAmount: 0,
        acceptedAmount: 0,
        rejectedAmount: 0,
        pendingAmount: 0,
        recoveredAmount: 0,
        remainingAmount: 0
      },
      months: {}
    };

    data.forEach(row => {
      const { company, month } = row._id;
      const monthName = MONTH_NAMES[month - 1];

      if (!response.months[monthName]) {
        response.months[monthName] = {
          month: monthName,
          overall: {
            totalCases: 0,
            acceptedCases: 0,
            rejectedCases: 0,
            pendingCases: 0,
            totalClaimedAmount: 0,
            acceptedAmount: 0,
            rejectedAmount: 0,
            pendingAmount: 0,
            recoveredAmount: 0,
            remainingAmount: 0
          },
          companies: []
        };
      }

      response.months[monthName].companies.push({
        company,
        totalCases: row.totalCases,
        acceptedCases: row.acceptedCases,
        rejectedCases: row.rejectedCases,
        pendingCases: row.pendingCases,
        totalClaimedAmount: row.totalClaimedAmount,
        acceptedAmount: row.acceptedAmount,
        rejectedAmount: row.rejectedAmount,
        pendingAmount: row.pendingAmount,
        recoveredAmount: row.recoveredAmount,
        remainingAmount: row.remainingAmount
      });

      Object.keys(response.overall).forEach(key => {
        response.months[monthName].overall[key] += row[key];
        response.overall[key] += row[key];
      });
    });

    res.status(200).json(response);

  } catch (err) {
    console.error("Yearly TPA Error:", err);
    res.status(500).json({ message: "Failed to generate yearly TPA report." });
  }
};


export const getMonthlyTPAReport = async (req, res) => {
  try {
    const {
      year,
      month,
      company,
      startDate: customStart,
      endDate: customEnd
    } = req.query;

    const { hospitalId } = req.session;

    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context." });
    }

    let startDate, endDate;
    let y, m;

    // ✅ If custom date range provided
    if (customStart && customEnd) {
      startDate = new Date(customStart);
      endDate = new Date(customEnd);
      y = startDate.getFullYear();
      m = startDate.getMonth() + 1;
    } else {
      if (!year || !month) {
        return res.status(400).json({
          message: "Year and month are required (unless using custom startDate & endDate)."
        });
      }

      y = parseInt(year);
      m = parseInt(month);

      startDate = new Date(Date.UTC(y, m - 1, 1));
      endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59));
    }

    const data = await AdmissionRequest.aggregate(
      buildTPAAggregation({
        hospitalId,
        startDate,
        endDate,
        groupByMonth: false,
        company
      })
    );

    const response = {
      year: y,
      month: MONTH_NAMES[m - 1],
      overall: {
        totalCases: 0,
        acceptedCases: 0,
        rejectedCases: 0,
        pendingCases: 0,
        totalClaimedAmount: 0,
        acceptedAmount: 0,
        rejectedAmount: 0,
        pendingAmount: 0,
        recoveredAmount: 0,
        remainingAmount: 0
      },
      companies: []
    };

    data.forEach(row => {
      response.companies.push({
        company: row._id.company,
        totalCases: row.totalCases,
        acceptedCases: row.acceptedCases,
        rejectedCases: row.rejectedCases,
        pendingCases: row.pendingCases,
        totalClaimedAmount: row.totalClaimedAmount,
        acceptedAmount: row.acceptedAmount,
        rejectedAmount: row.rejectedAmount,
        pendingAmount: row.pendingAmount,
        recoveredAmount: row.recoveredAmount,
        remainingAmount: row.remainingAmount
      });

      Object.keys(response.overall).forEach(key => {
        response.overall[key] += row[key];
      });
    });

    res.status(200).json(response);

  } catch (err) {
    console.error("Monthly TPA Error:", err);
    res.status(500).json({ message: "Failed to generate monthly TPA report." });
  }
};

const OPD_CATEGORY = "Doctor Consultation";
const IPD_CATEGORY = "Daily Doctor Visit";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

// ---------- helpers ----------
const iso = (d) => {
  const local = new Date(d.getTime() - d.getTimezoneOffset() * 60000);
  return local.toISOString().split("T")[0];
};

const getWeekStart = d => {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0, 0, 0, 0);
  return date;
};

// ---------- controller ----------
export const earningsOverviewReport = async (req, res) => {
  try {
    const {
      range = "today",
      date,
      startDate,
      endDate
    } = req.query;

    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context" });
    }

    const base = date ? new Date(date) : new Date();
    let from, to, trendUnit, label, buckets = [];

    // ✅ CUSTOM DATE RANGE (PRIORITY)
    if (startDate && endDate) {
      from = new Date(startDate);
      to = new Date(endDate);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);

      trendUnit = "day";
      label = "Custom Range";

      const diffDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
      buckets = Array.from({ length: diffDays + 1 }, (_, i) => {
        const d = new Date(from);
        d.setDate(from.getDate() + i);
        return iso(d);
      });

    } else {

      // ---------- PREDEFINED RANGE RESOLUTION ----------
      switch (range) {
        case "today": {
          from = new Date(base); from.setHours(0, 0, 0, 0);
          to = new Date(base); to.setHours(23, 59, 59, 999);
          trendUnit = "hour";
          label = "Today";
          buckets = Array.from({ length: 24 }, (_, i) =>
            `${String(i).padStart(2, "0")}:00`
          );
          break;
        }

        case "last_7_days": {
          to = new Date(base); to.setHours(23, 59, 59, 999);
          from = new Date(to); from.setDate(to.getDate() - 6); from.setHours(0, 0, 0, 0);
          trendUnit = "day";
          label = "Last 7 Days";
          buckets = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(from);
            d.setDate(from.getDate() + i);
            return iso(d);
          });
          break;
        }

        case "this_week": {
          from = getWeekStart(base);
          to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23, 59, 59, 999);
          trendUnit = "day";
          label = "This Week";
          buckets = WEEK_DAYS;
          break;
        }

        case "last_week": {
          to = getWeekStart(base); to.setDate(to.getDate() - 1); to.setHours(23, 59, 59, 999);
          from = new Date(to); from.setDate(to.getDate() - 6); from.setHours(0, 0, 0, 0);
          trendUnit = "day";
          label = "Last Week";
          buckets = WEEK_DAYS;
          break;
        }

        case "this_month": {
          from = new Date(base.getFullYear(), base.getMonth(), 1);
          to = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23, 59, 59);
          trendUnit = "week";
          label = "This Month";
          buckets = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];
          break;
        }

        case "this_year": {
          from = new Date(base.getFullYear(), 0, 1);
          to = new Date(base.getFullYear(), 11, 31, 23, 59, 59);
          trendUnit = "month";
          label = "This Year";
          buckets = MONTHS;
          break;
        }

        default:
          return res.status(400).json({ message: "Invalid range" });
      }
    }

    // ---------- AGGREGATION ----------
    const data = await Bill.aggregate([
      { $match: { hospital: new mongoose.Types.ObjectId(hospitalId) } },
      { $unwind: "$services" },

      {
        $addFields: {
          eventDate: {
            $cond: [
              { $eq: ["$services.category", OPD_CATEGORY] },
              "$invoiceDate",
              {
                $cond: [
                  { $ifNull: ["$services.details.visitDate", false] },
                  { $dateFromString: { dateString: "$services.details.visitDate" } },
                  "$invoiceDate"
                ]
              }
            ]
          }
        }
      },

      { $match: { eventDate: { $gte: from, $lte: to } } },

      {
        $group: {
          _id: {
            bucket:
              trendUnit === "hour" ? { $hour: "$eventDate" } :
                trendUnit === "day" ? { $dateToString: { format: "%Y-%m-%d", date: "$eventDate" } } :
                  trendUnit === "week" ? { $week: "$eventDate" } :
                    { $month: "$eventDate" },
            type: "$services.category"
          },
          count: { $sum: 1 },
          earnings: { $sum: { $multiply: ["$services.rate", "$services.quantity"] } }
        }
      }
    ]);

    // ---------- TOTALS ----------
    let opdPatients = 0, ipdPatients = 0;
    let opdEarnings = 0, ipdEarnings = 0;

    data.forEach(d => {
      if (d._id.type === OPD_CATEGORY) {
        opdPatients += d.count;
        opdEarnings += d.earnings;
      }
      if (d._id.type === IPD_CATEGORY) {
        ipdPatients += d.count;
        ipdEarnings += d.earnings;
      }
    });

    const map = {};
    buckets.forEach(b => {
      map[b] = { opdPatients: 0, ipdPatients: 0, opdEarnings: 0, ipdEarnings: 0 };
    });

    data.forEach(d => {
      let key;
      if (trendUnit === "hour") key = `${String(d._id.bucket).padStart(2, "0")}:00`;
      else if (trendUnit === "month") key = MONTHS[d._id.bucket - 1];
      else if (trendUnit === "week") key = `Week ${d._id.bucket}`;
      else key = d._id.bucket;

      if (!map[key]) return;

      if (d._id.type === OPD_CATEGORY) {
        map[key].opdPatients += d.count;
        map[key].opdEarnings += d.earnings;
      }
      if (d._id.type === IPD_CATEGORY) {
        map[key].ipdPatients += d.count;
        map[key].ipdEarnings += d.earnings;
      }
    });

    res.status(200).json({
      range: {
        key: startDate && endDate ? "custom" : range,
        from: iso(from),
        to: iso(to),
        label
      },
      earnings: {
        totalEarnings: opdEarnings + ipdEarnings,
        opdEarnings,
        ipdEarnings
      },
      patients: {
        totalPatients: opdPatients + ipdPatients,
        opdPatients,
        ipdPatients
      },
      trends: {
        earnings: buckets.map(b => ({
          [trendUnit]: b,
          opd: map[b].opdEarnings,
          ipd: map[b].ipdEarnings
        })),
        patients: buckets.map(b => ({
          [trendUnit]: b,
          opd: map[b].opdPatients,
          ipd: map[b].ipdPatients
        }))
      }
    });

  } catch (error) {
    console.error("Earnings overview error:", error);
    res.status(500).json({
      message: "Error generating earnings overview",
      error: error.message
    });
  }
};

export const roomBedReport = async (req, res) => {
  try {
    const {
      range = "today",
      date,
      startDate,
      endDate
    } = req.query;

    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context" });
    }

    const base = date ? new Date(date) : new Date();
    let from, to, trendUnit, label, buckets = [];

    // ==============================
    // RANGE RESOLUTION
    // ==============================

    if (startDate && endDate) {
      from = new Date(startDate);
      to = new Date(endDate);
      from.setHours(0, 0, 0, 0);
      to.setHours(23, 59, 59, 999);

      trendUnit = "day";
      label = "Custom Range";

      const diffDays = Math.ceil((to - from) / (1000 * 60 * 60 * 24));
      buckets = Array.from({ length: diffDays + 1 }, (_, i) => {
        const d = new Date(from);
        d.setDate(from.getDate() + i);
        return iso(d);
      });

    } else {

      switch (range) {

        case "today": {
          from = new Date(base);
          from.setHours(0, 0, 0, 0);

          to = new Date(base);
          to.setHours(23, 59, 59, 999);

          trendUnit = "hour";
          label = "Today";
          buckets = Array.from({ length: 24 }, (_, i) =>
            `${String(i).padStart(2, "0")}:00`
          );
          break;
        }

        case "last_7_days": {
          to = new Date(base);
          to.setHours(23, 59, 59, 999);

          from = new Date(to);
          from.setDate(to.getDate() - 6);
          from.setHours(0, 0, 0, 0);

          trendUnit = "day";
          label = "Last 7 Days";
          buckets = Array.from({ length: 7 }, (_, i) => {
            const d = new Date(from);
            d.setDate(from.getDate() + i);
            return iso(d);
          });
          break;
        }

        case "this_month": {
          const year = new Date().getFullYear();
          const month = new Date().getMonth();

          from = new Date(year, month, 1);
          to = new Date(year, month + 1, 0, 23, 59, 59);

          trendUnit = "week";
          label = "This Month";
          buckets = ["Week 1", "Week 2", "Week 3", "Week 4", "Week 5"];
          break;
        }

        case "this_year": {
          const year = new Date().getFullYear();

          from = new Date(year, 0, 1);
          to = new Date(year, 11, 31, 23, 59, 59);

          trendUnit = "month";
          label = "This Year";
          buckets = MONTHS;
          break;
        }

        default:
          return res.status(400).json({ message: "Invalid range" });
      }
    }
    // ==============================
    // SUMMARY + ROOM REVENUE AGGREGATION (FILTERED)
    // ==============================

    const totalRooms = await Room.countDocuments({ hospital: hospitalId });
    const totalBeds = await Bed.countDocuments({ hospital: hospitalId });

    const revenueData = await Bill.aggregate([

      {
        $match: {
          hospital: new mongoose.Types.ObjectId(hospitalId)
        }
      },

      { $unwind: "$services" },

      {
        $match: {
          "services.details.bedType": { $exists: true },
          "services.details.billedDate": {
            $gte: iso(from),
            $lte: iso(to)
          }
        }
      },

      {
        $addFields: {
          billedDateObj: {
            $dateFromString: {
              dateString: "$services.details.billedDate"
            }
          }
        }
      },

      {
        $group: {
          _id: {
            date: "$services.details.billedDate",
            month: { $month: "$billedDateObj" },
            roomType: "$services.details.bedType"
          },
          revenue: {
            $sum: { $multiply: ["$services.rate", "$services.quantity"] }
          },
          occupiedEntries: { $sum: 1 }
        }
      }

    ]);

    // ==============================
    // PROCESS FILTERED DATA
    // ==============================

    const map = {};
    buckets.forEach(b => {
      map[b] = { revenue: 0 };
    });

    const revenueByRoomType = {};

    let totalRoomRevenue = 0;
    let totalOccupiedEntries = 0;

    revenueData.forEach(item => {

      totalRoomRevenue += item.revenue;
      totalOccupiedEntries += item.occupiedEntries;

      // Revenue by room type
      if (!revenueByRoomType[item._id.roomType]) {
        revenueByRoomType[item._id.roomType] = 0;
      }

      revenueByRoomType[item._id.roomType] += item.revenue;

      // Date-wise revenue
      let key;


      if (trendUnit === "month") {

        key = MONTHS[item._id.month - 1];

      } else if (trendUnit === "week") {

        const dayOfMonth = new Date(item._id.date).getDate();
        const weekNumber = Math.ceil(dayOfMonth / 7);
        key = `Week ${weekNumber}`;

      } else if (trendUnit === "day") {

        key = item._id.date;

      } else {

        key = item._id.date;

      }

      if (map[key]) {
        map[key].revenue += item.revenue;
      }
    });

    // ==============================
    // FILTER-BASED OCCUPANCY
    // ==============================

    const totalDays = buckets.length;

    // average beds occupied per day during selected range
    const avgOccupiedBeds =
      totalDays > 0 ? (totalOccupiedEntries / totalDays) : 0;

    const occupiedBeds = Math.round(avgOccupiedBeds);

    const availableBeds =
      totalBeds - occupiedBeds;

    const occupancyPercentage =
      totalBeds > 0
        ? ((occupiedBeds / totalBeds) * 100).toFixed(2)
        : 0;

    // ==============================
    // FINAL RESPONSE
    // ==============================

    res.status(200).json({

      range: {
        key: startDate && endDate ? "custom" : range,
        from: iso(from),
        to: iso(to),
        label
      },

      summary: {
        totalRooms,
        totalBeds,
        occupiedBeds,
        availableBeds,
        occupancyPercentage: `${occupancyPercentage}%`
      },

      revenue: {
        totalRoomRevenue,
        revenueByRoomType: Object.entries(revenueByRoomType)
          .map(([roomType, revenue]) => ({
            roomType,
            revenue
          }))
      },

      trends: {
        dateWiseRevenue: buckets.map(b => ({
          [trendUnit]: b,
          revenue: map[b]?.revenue || 0
        }))
      }

    });

  } catch (error) {
    console.error("Room/Bed report error:", error);
    res.status(500).json({
      message: "Error generating room/bed report",
      error: error.message
    });
  }
};