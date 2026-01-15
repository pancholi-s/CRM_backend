import Doctor from "../models/doctorModel.js";
import Department from "../models/departmentModel.js";
import mongoose from "mongoose";
import Bill from "../models/billModel.js";

export const getDoctorsByHospital = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch total count of doctors
    const totalDoctors = await Doctor.countDocuments({ hospital: hospitalId });

    // Fetch doctors with pagination
    const doctors = await Doctor.find({ hospital: hospitalId })
      .select("name email phone specialization status")
      .populate("departments", "name")
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      message: "Doctors retrieved successfully",
      count: doctors.length,
      totalDoctors,
      totalPages: Math.ceil(totalDoctors / limit),
      currentPage: page,
      doctors,
    });
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ message: "Error fetching doctors" });
  }
};

export const getDoctorsByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const hospitalId = req.session.hospitalId;
    const { page = 1, limit = 10 } = req.query; // Default to page 1, limit 10

    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context not found in session." });
    }

    const department = await Department.findOne({ _id: departmentId, hospital: hospitalId });
    if (!department) {
      return res.status(404).json({ message: "Department not found in this hospital." });
    }

    const doctors = await Doctor.find({ departments: departmentId, hospital: hospitalId })
      .select("name email phone specialization status")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalDoctors = await Doctor.countDocuments({ departments: departmentId, hospital: hospitalId });

    res.status(200).json({
      message: `Doctors retrieved for department ${department.name}`,
      totalDoctors,
      page: parseInt(page),
      totalPages: Math.ceil(totalDoctors / limit),
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error("Error fetching doctors by department:", error);
    res.status(500).json({ message: "Error fetching doctors by department" });
  }
};


export const doctorEarningsReport = async (req, res) => {
  try {
    const { doctorId, startDate, endDate } = req.query;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context" });
    }

    // ---------------- FETCH DOCTORS ----------------
    const doctorFilter = doctorId
      ? { _id: new mongoose.Types.ObjectId(doctorId) }
      : { hospital: hospitalId };

    const doctors = await Doctor.find(doctorFilter)
      .select("_id name")
      .lean();

    if (!doctors.length) {
      return res.status(200).json({ count: 0, doctors: [] });
    }

    const doctorIds = doctors.map(d => d._id);
    const hospitalObjectId = new mongoose.Types.ObjectId(hospitalId);

    // ---------------- AGGREGATION ----------------
    const earnings = await Bill.aggregate([
      {
        $match: {
          hospital: hospitalObjectId,
          $or: [
            { doctor: { $in: doctorIds } }, // OPD
            { "services.details.doctorId": { $in: doctorIds } } // IPD
          ]
        }
      },

      { $unwind: "$services" },

      {
        $facet: {
          // ================= OPD =================
          opd: [
            {
              $match: {
                doctor: { $in: doctorIds },
                "services.category": "Doctor Consultation",
                ...(startDate || endDate
                  ? {
                      invoiceDate: {
                        ...(startDate ? { $gte: new Date(startDate) } : {}),
                        ...(endDate ? { $lte: new Date(endDate) } : {})
                      }
                    }
                  : {})
              }
            },
            {
              $group: {
                _id: "$doctor",
                count: { $sum: 1 },
                earnings: {
                  $sum: {
                    $multiply: ["$services.rate", "$services.quantity"]
                  }
                }
              }
            }
          ],

          // ================= IPD =================
          ipd: [
            {
              $match: {
                "services.category": "Daily Doctor Visit",
                "services.details.doctorId": { $in: doctorIds }
              }
            },

            ...(startDate || endDate
              ? [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          ...(startDate
                            ? [
                                {
                                  $gte: [
                                    {
                                      $dateFromString: {
                                        dateString:
                                          "$services.details.visitDate"
                                      }
                                    },
                                    new Date(startDate)
                                  ]
                                }
                              ]
                            : []),
                          ...(endDate
                            ? [
                                {
                                  $lte: [
                                    {
                                      $dateFromString: {
                                        dateString:
                                          "$services.details.visitDate"
                                      }
                                    },
                                    new Date(endDate)
                                  ]
                                }
                              ]
                            : [])
                        ]
                      }
                    }
                  }
                ]
              : []),

            {
              $group: {
                _id: "$services.details.doctorId",
                count: { $sum: 1 },
                earnings: {
                  $sum: {
                    $multiply: ["$services.rate", "$services.quantity"]
                  }
                }
              }
            }
          ]
        }
      }
    ]);

    const opdMap = new Map(
      (earnings[0].opd || []).map(o => [String(o._id), o])
    );
    const ipdMap = new Map(
      (earnings[0].ipd || []).map(i => [String(i._id), i])
    );

    // ---------------- MERGE RESULTS ----------------
    const result = doctors.map(doc => {
      const opd = opdMap.get(String(doc._id)) || { count: 0, earnings: 0 };
      const ipd = ipdMap.get(String(doc._id)) || { count: 0, earnings: 0 };

      return {
        doctorId: doc._id,
        doctorName: doc.name,

        opd: {
          count: opd.count,
          earnings: opd.earnings
        },

        ipd: {
          count: ipd.count,
          earnings: ipd.earnings
        },

        total: {
          count: opd.count + ipd.count,
          earnings: opd.earnings + ipd.earnings
        }
      };
    });

    // ---------------- RESPONSE ----------------
    if (doctorId) {
      return res.status(200).json(result[0]);
    }

    res.status(200).json({
      count: result.length,
      doctors: result
    });

  } catch (error) {
    console.error("Doctor earnings report error:", error);
    res.status(500).json({
      message: "Error generating doctor earnings report",
      error: error.message
    });
  }
};