import mongoose from "mongoose";
import Room from "../models/roomModel.js";
import Hospital from "../models/hospitalModel.js";
import Department from "../models/departmentModel.js";
import Doctor from "../models/doctorModel.js";

export const addRoom = async (req, res) => {
  const {
    roomID,
    name,
    roomType,
    doctorId,
    status,
    capacity,
    features,
    floor,
    wing,
  } = req.body;

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
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: "Hospital not found." });
    }

    if (!doctorId) {
      return res
        .status(400)
        .json({ message: "Doctor ID is required to assign a room." });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !hospital.doctors.includes(doctorId)) {
      return res
        .status(404)
        .json({ message: "Doctor not found in the specified hospital." });
    }

    if (!doctor.departments || doctor.departments.length === 0) {
      return res
        .status(400)
        .json({ message: "Doctor is not assigned to any department." });
    }

    const departmentId = doctor.departments[0];
    const department = await Department.findById(departmentId);
    if (!department || !hospital.departments.includes(departmentId)) {
      return res
        .status(404)
        .json({ message: "Department not found in the specified hospital." });
    }

    if (!capacity || !capacity.totalBeds || capacity.totalBeds < 1) {
      return res
        .status(400)
        .json({ message: "Room must have at least 1 bed capacity." });
    }

    const newRoom = new Room({
      roomID,
      name,
      roomType: roomType || "General Ward",
      hospital: hospitalId,
      department: departmentId,
      assignedDoctor: doctorId,
      status: status || "Available",
      capacity: {
        totalBeds: capacity.totalBeds,
        availableBeds: capacity.totalBeds,
      },
      features: features || {
        hasAC: false,
        hasTV: false,
        hasWiFi: false,
        hasAttachedBathroom: true,
      },
      floor: floor || 1,
      wing: wing || "Central",
    });

    await newRoom.save({ session });

    await Hospital.findByIdAndUpdate(
      hospitalId,
      { $push: { rooms: newRoom._id } },
      { session }
    );

    await Department.findByIdAndUpdate(
      departmentId,
      { $push: { rooms: newRoom._id } },
      { session }
    );

    await Doctor.findByIdAndUpdate(
      doctorId,
      { $push: { assignedRooms: newRoom._id } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const populatedRoom = await Room.findById(newRoom._id)
      .populate("hospital", "name")
      .populate("department", "name")
      .populate("assignedDoctor", "name")
      .lean();

    res.status(201).json({
      message: "Room added successfully.",
      room: populatedRoom,
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({
      message: "Error adding room.",
      error: error.message,
    });
  }
};

export const getRoomsByHospital = async (req, res) => {
  const { departmentId, sort, roomType, status } = req.query;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  try {
    const filter = { hospital: hospitalId };
    if (departmentId) filter.department = departmentId;
    if (roomType) filter.roomType = roomType;
    if (status) filter.status = status;

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const sortOrder = sort === "asc" ? 1 : -1;

    const totalRooms = await Room.countDocuments(filter);

    const rooms = await Room.find(filter)
      .populate("hospital", "name")
      .populate("department", "name")
      .populate("assignedDoctor", "name")
      .populate({
        path: "beds",
        select: "bedNumber bedType status assignedPatient",
        populate: {
          path: "assignedPatient",
          select: "name patientID",
        },
      })
      .sort({ createdAt: sortOrder })
      .skip(skip)
      .limit(limit)
      .lean();

    if (!rooms || rooms.length === 0) {
      return res.status(404).json({
        message: "No rooms found for this hospital.",
      });
    }

    const roomsWithStats = rooms.map((room) => {
      const capacity = room.capacity || { totalBeds: 0, availableBeds: 0 };
      const beds = room.beds || [];

      return {
        ...room,
        bedStatistics: {
          totalBeds: capacity.totalBeds || 0,
          availableBeds: capacity.availableBeds || 0,
          occupiedBeds:
            (capacity.totalBeds || 0) - (capacity.availableBeds || 0),
          bedsInRoom: beds.length,
        },
      };
    });

    return res.status(200).json({
      message: "Rooms retrieved successfully.",
      count: rooms.length,
      totalRooms,
      totalPages: Math.ceil(totalRooms / limit),
      currentPage: page,
      rooms: roomsWithStats,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching rooms.",
      error: error.message,
    });
  }
};

export const getRoomById = async (req, res) => {
  const { roomId } = req.params;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  try {
    const room = await Room.findOne({ _id: roomId, hospital: hospitalId })
      .populate("hospital", "name")
      .populate("department", "name")
      .populate("assignedDoctor", "name email phone")
      .populate({
        path: "beds",
        populate: {
          path: "assignedPatient",
          select: "name patientID age gender phone",
        },
      })
      .lean();

    if (!room) {
      return res.status(404).json({
        message: "Room not found in your hospital.",
      });
    }

    res.status(200).json({
      message: "Room details retrieved successfully.",
      room,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching room details.",
      error: error.message,
    });
  }
};

export const updateRoom = async (req, res) => {
  const { roomId } = req.params;
  const updateData = req.body;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({
      message: "Unauthorized access. Hospital ID not found in session.",
    });
  }

  try {
    const room = await Room.findOne({ _id: roomId, hospital: hospitalId });
    if (!room) {
      return res.status(404).json({
        message: "Room not found in your hospital.",
      });
    }

    if (updateData.capacity && updateData.capacity.totalBeds) {
      const Bed = mongoose.model("Bed");
      const existingBeds = await Bed.countDocuments({ room: roomId });

      if (updateData.capacity.totalBeds < existingBeds) {
        return res.status(400).json({
          message: `Cannot reduce capacity below existing bed count. Current beds: ${existingBeds}`,
        });
      }
    }

    const updatedRoom = await Room.findByIdAndUpdate(roomId, updateData, {
      new: true,
    })
      .populate("hospital", "name")
      .populate("department", "name")
      .populate("assignedDoctor", "name")
      .lean();

    res.status(200).json({
      message: "Room updated successfully.",
      room: updatedRoom,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error updating room.",
      error: error.message,
    });
  }
};
