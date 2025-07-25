import mongoose from "mongoose";
import Bed from "../models/bedModel.js";
import Room from "../models/roomModel.js";
import Patient from "../models/patientModel.js";

export const addBedsToRoom = async (req, res) => {
  const { roomId, beds } = req.body;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const room = await Room.findOne({ _id: roomId, hospital: hospitalId }).session(session);
    if (!room) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Room not found in your hospital." });
    }

    const existingBedCount = await Bed.countDocuments({ room: roomId }).session(session);
    if (existingBedCount + beds.length > room.capacity.totalBeds) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: `Cannot add ${beds.length} beds. Room capacity: ${room.capacity.totalBeds}, Current beds: ${existingBedCount}`,
      });
    }

    const newBeds = [];
    for (const bedData of beds) {
      const bedNumber =
        bedData.bedNumber ||
        `${room.roomID}-B${existingBedCount + newBeds.length + 1}`;

      const newBed = new Bed({
        bedNumber,
        bedType: bedData.bedType,
        room: roomId,
        hospital: hospitalId,
        department: room.department,
        features: bedData.features || {},
        charges: bedData.charges || { dailyRate: 0 },
      });

      await newBed.save({ session });
      newBeds.push(newBed);
    }

    // Commit transaction first to make beds visible
    await session.commitTransaction();
    session.endSession();

    // Now update available beds with committed data
    await room.updateAvailableBeds();

    const populatedBeds = await Bed.find({
      _id: { $in: newBeds.map((b) => b._id) },
    })
      .populate("room", "roomID name")
      .populate("department", "name")
      .lean();

    res.status(201).json({
      message: "Beds added successfully.",
      beds: populatedBeds,
      totalBedsAdded: newBeds.length,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: "Error adding beds.", error: error.message });
  }
};

export const getBedsByHospital = async (req, res) => {
  const {
    departmentId,
    roomId,
    status,
    bedType,
    page = 1,
    limit = 10,
  } = req.query;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res
      .status(403)
      .json({
        message: "Unauthorized access. Hospital ID not found in session.",
      });
  }

  try {
    let filter = { hospital: hospitalId };
    if (departmentId) filter.department = departmentId;
    if (roomId) filter.room = roomId;
    if (status) filter.status = status;
    if (bedType) filter.bedType = bedType;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const totalBeds = await Bed.countDocuments(filter);

    const beds = await Bed.find(filter)
      .populate("room", "roomID name roomType")
      .populate("department", "name")
      .populate("assignedPatient", "name patientID age gender")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      message: "Beds retrieved successfully.",
      count: beds.length,
      totalBeds,
      totalPages: Math.ceil(totalBeds / parseInt(limit)),
      currentPage: parseInt(page),
      beds,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching beds.", error: error.message });
  }
};

export const assignPatientToBed = async (req, res) => {
  const { bedId, patientId } = req.body;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res
      .status(403)
      .json({
        message: "Unauthorized access. Hospital ID not found in session.",
      });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bed = await Bed.findOne({ _id: bedId, hospital: hospitalId });
    if (!bed) {
      return res
        .status(404)
        .json({ message: "Bed not found in your hospital." });
    }

    if (bed.status !== "Available") {
      return res
        .status(400)
        .json({ message: "Bed is not available for assignment." });
    }

    const patient = await Patient.findOne({
      _id: patientId,
      hospital: hospitalId,
    });
    if (!patient) {
      return res
        .status(404)
        .json({ message: "Patient not found in your hospital." });
    }

    const existingBed = await Bed.findOne({
      assignedPatient: patientId,
      status: "Occupied",
    });
    if (existingBed) {
      return res
        .status(400)
        .json({ message: "Patient is already assigned to another bed." });
    }

    bed.assignedPatient = patientId;
    bed.status = "Occupied";
    bed.assignedDate = new Date();
    await bed.save({ session });

    const room = await Room.findById(bed.room);
    await room.updateAvailableBeds();

    await session.commitTransaction();
    session.endSession();

    const updatedBed = await Bed.findById(bedId)
      .populate("room", "roomID name")
      .populate("assignedPatient", "name patientID age gender")
      .lean();

    res.status(200).json({
      message: "Patient assigned to bed successfully.",
      bed: updatedBed,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res
      .status(500)
      .json({
        message: "Error assigning patient to bed.",
        error: error.message,
      });
  }
};

export const dischargePatientFromBed = async (req, res) => {
  const { bedId } = req.params;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res
      .status(403)
      .json({
        message: "Unauthorized access. Hospital ID not found in session.",
      });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bed = await Bed.findOne({ _id: bedId, hospital: hospitalId });
    if (!bed) {
      return res
        .status(404)
        .json({ message: "Bed not found in your hospital." });
    }

    if (bed.status !== "Occupied") {
      return res
        .status(400)
        .json({ message: "Bed is not currently occupied." });
    }

    bed.assignedPatient = null;
    bed.status = "Available";
    bed.dischargeDate = new Date();
    await bed.save({ session });

    const room = await Room.findById(bed.room);
    await room.updateAvailableBeds();

    await session.commitTransaction();
    session.endSession();

    res.status(200).json({
      message: "Patient discharged from bed successfully.",
      bedId: bed._id,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res
      .status(500)
      .json({
        message: "Error discharging patient from bed.",
        error: error.message,
      });
  }
};

export const getHospitalStatistics = async (req, res) => {
  const hospitalId = req.session.hospitalId;
  const { departmentId } = req.query;

  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  try {
    const filter = {
      hospital: new mongoose.Types.ObjectId(hospitalId),
    };

    if (departmentId) {
      filter.department = new mongoose.Types.ObjectId(departmentId);
    }

    // ========== Basic Counts ==========
    const totalPatients = await Patient.countDocuments(filter);

    const totalRooms = await Room.countDocuments(filter);

    const totalBeds = await Bed.countDocuments(filter);

    const availableBeds = await Bed.countDocuments({
      ...filter,
      status: "Available",
    });

    const roomsWithAvailableBeds = await Room.countDocuments({
      hospital: hospitalId,
      ...(departmentId && { department: departmentId }),
      "capacity.availableBeds": { $gt: 0 },
    });

    // ========== Aggregated Types ==========
    const bedTypes = await Bed.aggregate([
      { $match: filter },
      {
        $group: {
          _id: "$bedType",
          total: { $sum: 1 },
          available: {
            $sum: { $cond: [{ $eq: ["$status", "Available"] }, 1, 0] },
          },
        },
      },
    ]);

    const roomTypes = await Room.aggregate([
      {
        $match: {
          hospital: new mongoose.Types.ObjectId(hospitalId),
          ...(departmentId && { department: new mongoose.Types.ObjectId(departmentId) }),
        },
      },
      {
        $group: {
          _id: "$roomType",
          total: { $sum: 1 },
          withAvailableBeds: {
            $sum: { $cond: [{ $gt: ["$capacity.availableBeds", 0] }, 1, 0] },
          },
        },
      },
    ]);

    // ========== Department Summary (only if not filtered) ==========
    let departmentWise = [];

    if (!departmentId) {
      departmentWise = await Room.aggregate([
        { $match: { hospital: new mongoose.Types.ObjectId(hospitalId) } },
        {
          $lookup: {
            from: "beds",
            localField: "_id",
            foreignField: "room",
            as: "beds",
          },
        },
        {
          $group: {
            _id: "$department",
            totalRooms: { $sum: 1 },
            totalBeds: { $sum: { $size: "$beds" } },
            availableBeds: {
              $sum: {
                $size: {
                  $filter: {
                    input: "$beds",
                    cond: { $eq: ["$$this.status", "Available"] },
                  },
                },
              },
            },
            roomsWithBeds: {
              $sum: {
                $cond: [{ $gt: ["$capacity.availableBeds", 0] }, 1, 0],
              },
            },
          },
        },
        {
          $lookup: {
            from: "departments",
            localField: "_id",
            foreignField: "_id",
            as: "dept",
          },
        },
        {
          $project: {
            departmentName: { $arrayElemAt: ["$dept.name", 0] },
            totalRooms: 1,
            totalBeds: 1,
            availableBeds: 1,
            roomsWithBeds: 1,
            bedOccupancyRate: {
              $round: [
                {
                  $multiply: [
                    {
                      $divide: [
                        { $subtract: ["$totalBeds", "$availableBeds"] },
                        "$totalBeds",
                      ],
                    },
                    100,
                  ],
                },
                1,
              ],
            },
          },
        },
      ]);
    }

    // ========== Final Response ==========
    const occupancyRate =
      totalBeds > 0
        ? (((totalBeds - availableBeds) / totalBeds) * 100).toFixed(1)
        : "0.0";

    res.status(200).json({
      message: departmentId
        ? "Department statistics retrieved successfully."
        : "Hospital statistics retrieved successfully.",
      statistics: {
        patients: { total: totalPatients },
        rooms: {
          total: totalRooms,
          available: roomsWithAvailableBeds,
        },
        beds: {
          total: totalBeds,
          available: availableBeds,
          occupancyRate,
        },
        ...(departmentId ? {} : { departmentWise }),
        bedTypes,
        roomTypes,
      },
    });
  } catch (error) {
    console.error("Hospital statistics error:", error);
    res.status(500).json({
      message: "Error fetching hospital statistics.",
      error: error.message,
    });
  }
};

export const getPatientBedInfo = async (req, res) => {
  const { patientId } = req.params;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  try {
    const bed = await Bed.findOne({
      hospital: hospitalId,
      assignedPatient: patientId,
      status: "Occupied",
    })
      .populate("room")
      .populate("assignedPatient")
      .lean();

    if (!bed) {
      return res.status(404).json({
        message: "No active bed assignment found for this patient.",
      });
    }

    const {
      bedNumber,
      bedType,
      features,
      assignedDate,
      room,
      assignedPatient,
    } = bed;

    const bedInfo = {
      bedNumber,
      bedType,
      features,
      assignedDate,
    };

    const roomInfo = {
      roomID: room.roomID,
      name: room.name,
      roomType: room.roomType,
      ward: room.ward,
      floor: room.floor,
    };

    const patientInfo = {
      name: assignedPatient.name,
      patientID: assignedPatient.patientID,
      age: assignedPatient.age,
      gender: assignedPatient.gender,
    };

    res.status(200).json({
      message: "Patient bed and room info retrieved successfully.",
      patientInfo,
      bedInfo,
      roomInfo,
    });
  } catch (error) {
    console.error("Error retrieving bed info:", error);
    res.status(500).json({
      message: "Internal server error.",
      error: error.message,
    });
  }
};
