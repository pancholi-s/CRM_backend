import mongoose from "mongoose";
import AdmissionRequest from "../models/admissionReqModel.js";
import Bill from "../models/billModel.js";

const MONTH_NAMES = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December"
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
    "admissionDetails.insurance.hasInsurance": true,
    createdAt: { $gte: startDate, $lte: endDate }
  };

  if (company) {
    matchStage["admissionDetails.insurance.insuranceCompany"] = company;
  } else {
    matchStage["admissionDetails.insurance.insuranceCompany"] = { $ne: null };
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
        approvedAmount: {
          $ifNull: ["$admissionDetails.insurance.amountApproved", 0]
        },
        status: "$admissionDetails.insurance.insuranceApproved",
        company: "$admissionDetails.insurance.insuranceCompany",
        month: { $month: "$createdAt" }
      }
    },

    {
      $group: {
        _id: {
          company: "$company",
          ...(groupByMonth ? { month: "$month" } : {})
        },

        totalCases: { $sum: 1 },
        acceptedCases: { $sum: { $cond: [{ $eq: ["$status", "approved"] }, 1, 0] } },
        rejectedCases: { $sum: { $cond: [{ $eq: ["$status", "rejected"] }, 1, 0] } },
        pendingCases: { $sum: { $cond: [{ $eq: ["$status", "pending"] }, 1, 0] } },

        totalClaimedAmount: { $sum: "$billAmount" },

        acceptedAmount: {
          $sum: {
            $cond: [{ $eq: ["$status", "approved"] }, "$approvedAmount", 0]
          }
        },

        rejectedAmount: {
          $sum: {
            $cond: [
              { $eq: ["$status", "rejected"] },
              { $subtract: ["$billAmount", "$approvedAmount"] },
              0
            ]
          }
        },

        pendingAmount: {
          $sum: {
            $cond: [{ $eq: ["$status", "pending"] }, "$billAmount", 0]
          }
        }
      }
    },

    { $sort: { "_id.company": 1, "_id.month": 1 } }
  ];
};


export const getYearlyTPAReport = async (req, res) => {
  try {
    const { year, company } = req.query;
    const { hospitalId } = req.session;

    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context." });
    }

    const targetYear = parseInt(year) || new Date().getFullYear();
    const startDate = new Date(`${targetYear}-01-01T00:00:00.000Z`);
    const endDate = new Date(`${targetYear}-12-31T23:59:59.999Z`);

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
        pendingAmount: 0
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
            pendingAmount: 0
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
        pendingAmount: row.pendingAmount
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
    const { year, month, company } = req.query;
    const { hospitalId } = req.session;

    if (!hospitalId || !year || !month) {
      return res.status(400).json({ message: "Year and month are required." });
    }

    const y = parseInt(year);
    const m = parseInt(month);

    const startDate = new Date(Date.UTC(y, m - 1, 1));
    const endDate = new Date(Date.UTC(y, m, 0, 23, 59, 59));

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
        pendingAmount: 0
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
        pendingAmount: row.pendingAmount
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

const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const WEEK_DAYS = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];

// ---------- helpers ----------
const iso = d => d.toISOString().split("T")[0];

const getWeekStart = d => {
  const date = new Date(d);
  const day = date.getDay() || 7;
  date.setDate(date.getDate() - day + 1);
  date.setHours(0,0,0,0);
  return date;
};

// ---------- controller ----------
export const earningsOverviewReport = async (req, res) => {
  try {
    const { range = "today", date } = req.query;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context" });
    }

    const base = date ? new Date(date) : new Date();
    let from, to, trendUnit, label, buckets = [];

    // ---------- RANGE RESOLUTION ----------
    switch (range) {
      case "today": {
        from = new Date(base); from.setHours(0,0,0,0);
        to = new Date(base); to.setHours(23,59,59,999);
        trendUnit = "hour";
        label = "Today";
        buckets = Array.from({ length: 24 }, (_, i) =>
          `${String(i).padStart(2,"0")}:00`
        );
        break;
      }

      case "last_7_days": {
        to = new Date(base); to.setHours(23,59,59,999);
        from = new Date(to); from.setDate(to.getDate() - 6); from.setHours(0,0,0,0);
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
        to = new Date(from); to.setDate(from.getDate() + 6); to.setHours(23,59,59,999);
        trendUnit = "day";
        label = "This Week";
        buckets = WEEK_DAYS;
        break;
      }

      case "last_week": {
        to = getWeekStart(base); to.setDate(to.getDate() - 1); to.setHours(23,59,59,999);
        from = new Date(to); from.setDate(to.getDate() - 6); from.setHours(0,0,0,0);
        trendUnit = "day";
        label = "Last Week";
        buckets = WEEK_DAYS;
        break;
      }

      case "this_month": {
        from = new Date(base.getFullYear(), base.getMonth(), 1);
        to = new Date(base.getFullYear(), base.getMonth() + 1, 0, 23,59,59);
        trendUnit = "week";
        label = "This Month";
        buckets = ["Week 1","Week 2","Week 3","Week 4","Week 5"];
        break;
      }

      case "this_year": {
        from = new Date(base.getFullYear(), 0, 1);
        to = new Date(base.getFullYear(), 11, 31, 23,59,59);
        trendUnit = "month";
        label = "This Year";
        buckets = MONTHS;
        break;
      }

      default:
        return res.status(400).json({ message: "Invalid range" });
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
              trendUnit === "day"  ? { $dateToString: { format: "%Y-%m-%d", date: "$eventDate" } } :
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

    // ---------- TREND MAP ----------
    const map = {};
    buckets.forEach(b => {
      map[b] = {
        opdPatients: 0,
        ipdPatients: 0,
        opdEarnings: 0,
        ipdEarnings: 0
      };
    });

    data.forEach(d => {
      let key;
      if (trendUnit === "hour") key = `${String(d._id.bucket).padStart(2,"0")}:00`;
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

    // ---------- RESPONSE ----------
    res.status(200).json({
      range: {
        key: range,
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

