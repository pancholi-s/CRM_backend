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
    const room = await Room.findOne({
      _id: roomId,
      hospital: hospitalId,
    }).session(session);
    if (!room) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ message: "Room not found in your hospital." });
    }

    const existingBedCount = await Bed.countDocuments({ room: roomId }).session(
      session
    );
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
    res
      .status(500)
      .json({ message: "Error adding beds.", error: error.message });
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
    return res.status(403).json({
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
    return res.status(403).json({
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
    res.status(500).json({
      message: "Error assigning patient to bed.",
      error: error.message,
    });
  }
};

export const dischargePatientFromBed = async (req, res) => {
  const { bedId } = req.params;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res.status(403).json({
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

    if (bed.hasAttendant && bed.linkedAttendantBed) {
      const attendantBed = await Bed.findById(bed.linkedAttendantBed).session(session);
    if (attendantBed && attendantBed.isAttendantBed) {
        attendantBed.isAttendantBed = false;
        attendantBed.linkedPatientBed = null;
        attendantBed.attendantDetails = {};
        attendantBed.status = "Available";
        await attendantBed.save({ session });
    }
      
      bed.linkedAttendantBed = null;
      bed.hasAttendant = false;
    }
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
    res.status(500).json({
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
          ...(departmentId && {
            department: new mongoose.Types.ObjectId(departmentId),
          }),
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
      _id,
      bedNumber,
      bedType,
      features,
      assignedDate,
      room,
      assignedPatient,
    } = bed;

    const bedInfo = {
      bedId: _id,
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


export const getAvailableBeds = async (req, res) => {
  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Unauthorized. Hospital ID not found in session." });
  }

  try {
    const availableBeds = await Bed.find({
      hospital: hospitalId,
      status: "Available",
    })
      .populate("room", "name roomType")
      .populate("department", "name")
      .lean();

    res.status(200).json({
      message: "Available beds fetched successfully.",
      count: availableBeds.length,
      beds: availableBeds,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching available beds.",
      error: error.message,
    });
  }
};

export const transferPatientToBed = async (req, res) => {
  const { currentBedId, targetBedId } = req.body;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const currentBed = await Bed.findOne({
      _id: currentBedId,
      hospital: hospitalId,
      status: "Occupied",
    })
      .populate("assignedPatient", "name patientID")
      .session(session);

    if (!currentBed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Current bed not found or not occupied.",
      });
    }

    if (!currentBed.assignedPatient) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "No patient assigned to current bed.",
      });
    }

    const targetBed = await Bed.findOne({
      _id: targetBedId,
      hospital: hospitalId,
      status: "Available",
    }).session(session);

    if (!targetBed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Target bed not found or not available.",
      });
    }

    if (currentBedId === targetBedId) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Cannot transfer patient to the same bed.",
      });
    }

    const patientId = currentBed.assignedPatient._id;
    const patientInfo = {
      name: currentBed.assignedPatient.name,
      patientID: currentBed.assignedPatient.patientID,
    };

    currentBed.assignedPatient = null;
    currentBed.status = "Available";
    currentBed.dischargeDate = new Date();
    await currentBed.save({ session });

    targetBed.assignedPatient = patientId;
    targetBed.status = "Occupied";
    targetBed.assignedDate = new Date();
    targetBed.dischargeDate = null;
    await targetBed.save({ session });

    await session.commitTransaction();
    session.endSession();

    const currentRoom = await Room.findById(currentBed.room);
    const targetRoom = await Room.findById(targetBed.room);

    await currentRoom.updateAvailableBeds();
    if (currentRoom._id.toString() !== targetRoom._id.toString()) {
      await targetRoom.updateAvailableBeds();
    }

    const updatedTargetBed = await Bed.findById(targetBedId)
      .populate("room", "roomID name roomType floor wing")
      .populate("department", "name")
      .populate("assignedPatient", "name patientID age gender")
      .lean();

    const updatedCurrentBed = await Bed.findById(currentBedId)
      .populate("room", "roomID name")
      .lean();

    res.status(200).json({
      message: "Patient transferred successfully.",
      transfer: {
        patient: patientInfo,
        fromBed: {
          bedId: currentBed._id,
          bedNumber: currentBed.bedNumber,
          room: updatedCurrentBed.room,
        },
        toBed: {
          bedId: targetBed._id,
          bedNumber: targetBed.bedNumber,
          room: updatedTargetBed.room,
        },
        transferDate: new Date(),
      },
      updatedTargetBed,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      message: "Error transferring patient.",
      error: error.message,
    });
  }
};

export const requestAttendantBed = async (req, res) => {
  const {
    patientBedId,        
    attendantBedId,     
    attendantName,
    relationship,
    contactNumber,
    purpose,
    expectedDuration,
    additionalNotes
  } = req.body;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const patientBed = await Bed.findOne({
      _id: patientBedId,
      hospital: hospitalId,
      status: 'Occupied',
      assignedPatient: { $ne: null }
    }).session(session);

    if (!patientBed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Patient bed not found or not occupied.",
      });
    }

    const attendantBed = await Bed.findOne({
      _id: attendantBedId,
      hospital: hospitalId,
      status: 'Available',
    }).session(session);

    if (!attendantBed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Attendant bed is not available.",
      });
    }

    const existingRequest = await Bed.findOne({
      hospital: hospitalId,
      linkedPatientBed: patientBedId,
      'attendantDetails.status': { $in: ['Pending', 'Approved'] }
    }).session(session);

    if (existingRequest) {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Patient already has a pending/approved attendant bed request.",
      });
    }

    attendantBed.isAttendantBed = true;
    attendantBed.linkedPatientBed = patientBedId;
    patientBed.linkedAttendantBed = attendantBedId;
    patientBed.hasAttendant = true;
    await patientBed.save({ session });
    attendantBed.status = 'Reserved'; 
    attendantBed.attendantDetails = {
      name: attendantName,
      relationship,
      contactNumber,
      purpose,
      expectedDuration,
      additionalNotes,
      requestedBy: req.user.id,
      requestedByModel: req.user.role,
      status: 'Pending',
      requestDate: new Date(),
    };

    await attendantBed.save({ session });

    const room = await Room.findById(attendantBed.room);
    
    await session.commitTransaction();
    session.endSession();
    
    await room.updateAvailableBeds();

    const populatedBed = await Bed.findById(attendantBedId)
      .populate('linkedPatientBed', 'bedNumber assignedPatient')
      .populate('room', 'roomID name')
      .populate({
        path: 'linkedPatientBed',
        populate: {
          path: 'assignedPatient',
          select: 'name patientID'
        }
      })
      .lean();

    res.status(201).json({
      message: "Attendant bed request created successfully.",
      request: {
        attendantBed: populatedBed,
        status: 'Pending',
        waitingForApproval: true,
      },
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      message: "Error creating attendant bed request.",
      error: error.message,
    });
  }
};

export const getAttendantRequests = async (req, res) => {
  const { status, departmentId, page = 1, limit = 10 } = req.query;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  try {
    const filter = {
      hospital: hospitalId,
      isAttendantBed: true,
    };

    if (status) {
      filter['attendantDetails.status'] = status;
    }
    if (departmentId) {
      filter.department = departmentId;
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const totalRequests = await Bed.countDocuments(filter);

    const requests = await Bed.find(filter)
      .populate('linkedPatientBed', 'bedNumber assignedPatient')
      .populate({
        path: 'linkedPatientBed',
        populate: {
          path: 'assignedPatient',
          select: 'name patientID age gender'
        }
      })
      .populate('room', 'roomID name floor wing')
      .populate('department', 'name')
      .populate('attendantDetails.approvedBy', 'name')
      .sort({ 'attendantDetails.requestDate': -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    res.status(200).json({
      message: "Attendant requests retrieved successfully.",
      count: requests.length,
      totalRequests,
      totalPages: Math.ceil(totalRequests / parseInt(limit)),
      currentPage: parseInt(page),
      requests: requests.map(bed => ({
        attendantBedId: bed._id,
        bedNumber: bed.bedNumber,
        room: bed.room,
        patient: bed.linkedPatientBed?.assignedPatient,
        patientBed: bed.linkedPatientBed?.bedNumber,
        attendantDetails: bed.attendantDetails,
        requestStatus: bed.attendantDetails.status,
      })),
    });

  } catch (error) {
    res.status(500).json({
      message: "Error fetching attendant requests.",
      error: error.message,
    });
  }
};

export const processAttendantRequest = async (req, res) => {
  const { attendantBedId } = req.params;
  const { action, rejectionReason } = req.body;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const attendantBed = await Bed.findOne({
      _id: attendantBedId,
      hospital: hospitalId,
      isAttendantBed: true,
      'attendantDetails.status': 'Pending',
    }).session(session);

    if (!attendantBed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Attendant bed request not found or already processed.",
      });
    }

    if (req.user.role !== 'doctor' && req.user.role !== 'hospitalAdmin') {
      await session.abortTransaction();
      session.endSession();
      return res.status(403).json({
        message: "Only doctors or hospital admins can approve attendant bed requests.",
      });
    }

    if (action === 'approve') {
      attendantBed.attendantDetails.status = 'Approved';
      attendantBed.attendantDetails.approvedBy = req.user.id;
      attendantBed.attendantDetails.approvalDate = new Date();
      attendantBed.status = 'Occupied'; 
      
      await attendantBed.save({ session });

      await session.commitTransaction();
      session.endSession();

      const room = await Room.findById(attendantBed.room);
      await room.updateAvailableBeds();

      const populatedBed = await Bed.findById(attendantBedId)
        .populate('linkedPatientBed', 'bedNumber assignedPatient')
        .populate({
          path: 'linkedPatientBed',
          populate: {
            path: 'assignedPatient',
            select: 'name patientID'
          }
        })
        .populate('room', 'roomID name')
        .populate('attendantDetails.approvedBy', 'name')
        .lean();

      res.status(200).json({
        message: "Attendant bed request approved and assigned successfully.",
        assignment: {
          attendantBed: populatedBed,
          patient: populatedBed.linkedPatientBed?.assignedPatient,
          attendant: populatedBed.attendantDetails,
        },
      });

    } else if (action === 'reject') {

      const patientBedId = attendantBed.linkedPatientBed;
      const patientBed = await Bed.findById(patientBedId).session(session);
  
      attendantBed.attendantDetails.status = 'Rejected';
      attendantBed.attendantDetails.approvedBy = req.user.id;
      attendantBed.attendantDetails.approvalDate = new Date();
      attendantBed.attendantDetails.rejectionReason = rejectionReason;
      
      attendantBed.isAttendantBed = false;
      attendantBed.linkedPatientBed = null;
      attendantBed.status = 'Available';
      attendantBed.attendantDetails = {};

      if (patientBed) {
        patientBed.linkedAttendantBed = null;
        patientBed.hasAttendant = false;
        await patientBed.save({ session });
      }

      await attendantBed.save({ session });

      await session.commitTransaction();
      session.endSession();

      const room = await Room.findById(attendantBed.room);
      await room.updateAvailableBeds();

      res.status(200).json({
        message: "Attendant bed request rejected successfully.",
        rejection: {
          bedNumber: attendantBed.bedNumber,
          rejectionReason,
          rejectedBy: req.user.id,
        },
      });

    } else {
      await session.abortTransaction();
      session.endSession();
      return res.status(400).json({
        message: "Invalid action. Use 'approve' or 'reject'.",
      });
    }

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      message: "Error processing attendant request.",
      error: error.message,
    });
  }
};

export const releaseAttendantBed = async (req, res) => {
  const { attendantBedId } = req.params;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const attendantBed = await Bed.findOne({
      _id: attendantBedId,
      hospital: hospitalId,
      isAttendantBed: true,
      status: "Occupied",
      "attendantDetails.status": "Approved",
    }).session(session);

    if (!attendantBed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({
        message: "Attendant bed not found or not occupied by an attendant.",
      });
    }

    const patientBed = await Bed.findById(attendantBed.linkedPatientBed).session(session);
    if (patientBed) {
        patientBed.linkedAttendantBed = null;
        patientBed.hasAttendant = false;
        await patientBed.save({ session });
    }
    attendantBed.isAttendantBed = false;
    attendantBed.linkedPatientBed = null;
    attendantBed.attendantDetails = {};
    attendantBed.status = "Available";

    await attendantBed.save({ session });

    await session.commitTransaction();
    session.endSession();

    const room = await Room.findById(attendantBed.room);
    await room.updateAvailableBeds();

    res.status(200).json({
      message: "Attendant bed released successfully.",
      bedId: attendantBed._id,
      bedNumber: attendantBed.bedNumber,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      message: "Error releasing attendant bed.",
      error: error.message,
    });
  }
};

export const editBed = async (req, res) => {
  const { bedId } = req.params;
  const updates = req.body; 
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access. Hospital not found." });
  }

  if (!bedId) {
    return res.status(400).json({ message: "Bed ID is required." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const bed = await Bed.findOne({ _id: bedId, hospital: hospitalId }).session(session);
    if (!bed) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Bed not found in this hospital." });
    }

    Object.keys(updates).forEach((key) => {
      bed[key] = updates[key];
    });

    await bed.save({ session });

    await session.commitTransaction();
    session.endSession();

    const updatedBed = await Bed.findById(bedId)
      .populate("room", "roomID name")
      .populate("department", "name")
      .lean();

    res.status(200).json({
      message: "Bed updated successfully.",
      bed: updatedBed,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error updating bed:", error);
    res.status(500).json({ message: "Failed to update bed.", error: error.message });
  }
};