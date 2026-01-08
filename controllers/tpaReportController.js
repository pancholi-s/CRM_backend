import mongoose from "mongoose";
import AdmissionRequest from "../models/admissionReqModel.js";

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
