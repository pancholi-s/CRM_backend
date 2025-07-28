import mongoose from "mongoose";
import Room from "../models/roomModel.js";
import Hospital from "../models/hospitalModel.js";
import Department from "../models/departmentModel.js";
import Doctor from "../models/doctorModel.js";
import Bed from "../models/bedModel.js";

export const addRoom = async (req, res) => {
  const {
    roomID,
    name,
    roomType,
    doctorId,
    floor,
    wing,
    beds, // Array of beds
  } = req.body;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized. Hospital not found." });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) throw new Error("Hospital not found.");

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !hospital.doctors.includes(doctorId)) {
      throw new Error("Doctor not found in hospital.");
    }

    const departmentId = doctor.departments?.[0];
    if (!departmentId) throw new Error("Doctor not assigned to a department.");
    
    const department = await Department.findById(departmentId);
    if (!department || !hospital.departments.includes(departmentId)) {
      throw new Error("Department not found in hospital.");
    }

    const newRoom = new Room({
      roomID,
      name,
      roomType,
      hospital: hospitalId,
      department: departmentId,
      assignedDoctor: doctorId,
      floor,
      wing,
    });

    await newRoom.save({ session });

    await Hospital.findByIdAndUpdate(hospitalId, { $push: { rooms: newRoom._id } }, { session });
    await Department.findByIdAndUpdate(departmentId, { $push: { rooms: newRoom._id } }, { session });
    await Doctor.findByIdAndUpdate(doctorId, { $push: { assignedRooms: newRoom._id } }, { session });

    // Add beds (can be one or many)
    const bedsToInsert = beds?.map((bed) => ({
      bedNumber: bed.bedId,
      bedType: bed.roomType || roomType,
      room: newRoom._id,
      hospital: hospitalId,
      department: departmentId,
      status: bed.status || 'Available',
      assignedPatient: null,
      features: bed.features || {},
      charges: {
        dailyRate: bed.cost || 0,
        currency: "INR",
      },
    })) || [];

    if (bedsToInsert.length > 0) {
      await Bed.insertMany(bedsToInsert, { session });
    }

    await session.commitTransaction();
    session.endSession();

    const populatedRoom = await Room.findById(newRoom._id)
      .populate("hospital", "name")
      .populate("department", "name")
      .populate("assignedDoctor", "name")
      .lean();

    res.status(201).json({
      message: "Room and beds added successfully.",
      room: populatedRoom,
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
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
    if (roomType) {
      const roomTypesArray = roomType.split(",").map((type) => type.trim());
      filter.roomType = { $in: roomTypesArray };
    }
    if (status) {
      const statusArray = status.split(",").map((st) => st.trim());
      filter.status = { $in: statusArray };
}
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
