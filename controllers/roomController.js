import mongoose from 'mongoose';
import Room from '../models/roomModel.js';
import Hospital from '../models/hospitalModel.js';
import Department from '../models/departmentModel.js';
import Doctor from '../models/doctorModel.js';

// Add a new Room
export const addRoom = async (req, res) => {
  const { roomID, name, departmentId, doctorId, status } = req.body;

  // Get hospitalId from session
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: 'Unauthorized access. Hospital ID not found in session.' });
  }

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    // Validate hospital
    const hospital = await Hospital.findById(hospitalId);
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found.' });
    }

    // Validate department
    const department = await Department.findById(departmentId);
    if (!department || !hospital.departments.includes(departmentId)) {
      return res.status(404).json({ message: 'Department not found in the specified hospital.' });
    }

    // Validate doctor (optional)
    let doctor = null;
    if (doctorId) {
      doctor = await Doctor.findById(doctorId);
      if (!doctor || !hospital.doctors.includes(doctorId)) {
        return res.status(404).json({ message: 'Doctor not found in the specified hospital.' });
      }
    }

    // Create Room
    const newRoom = new Room({
      roomID,
      name,
      hospital: hospitalId,
      department: departmentId,
      assignedDoctor: doctorId || null,
      status,
    });

    await newRoom.save({ session });

    // Update references
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

    if (doctorId) {
      await Doctor.findByIdAndUpdate(
        doctorId,
        { $push: { assignedRooms: newRoom._id } },
        { session }
      );
    }

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: 'Room added successfully.', room: newRoom });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Error adding room.', error: error.message });
  }
};

// Get all Rooms (Filter by department)
export const getRooms = async (req, res) => {
  const { departmentId } = req.query;

  // Get hospitalId from session
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: 'Unauthorized access. Hospital ID not found in session.' });
  }

  try {
    let filter = { hospital: hospitalId };
    if (departmentId) filter.department = departmentId;

    const rooms = await Room.find(filter)
      .populate('hospital', 'name')
      .populate('department', 'name')
      .populate('assignedDoctor', 'name');

    res.status(200).json({ rooms });
  } catch (error) {
    res.status(500).json({ message: 'Error fetching rooms.', error: error.message });
  }
};

// Edit a Room - Update fields (name, roomID, status, assignedDoctor)
export const editRoom = async (req, res) => {
  const { id } = req.params;
  const { name, roomID, status, doctorId } = req.body;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    // Update fields
    room.name = name || room.name;
    room.roomID = roomID || room.roomID;
    room.status = status || room.status;

    // Handle doctor update
    if (doctorId) {
      const doctor = await Doctor.findById(doctorId);
      if (!doctor) {
        return res.status(404).json({ message: 'Doctor not found.' });
      }

      // Remove room from old doctor
      if (room.assignedDoctor) {
        await Doctor.findByIdAndUpdate(
          room.assignedDoctor,
          { $pull: { assignedRooms: id } },
          { session }
        );
      }

      // Assign new doctor
      room.assignedDoctor = doctorId;

      await Doctor.findByIdAndUpdate(
        doctorId,
        { $addToSet: { assignedRooms: id } },
        { session }
      );
    }

    await room.save({ session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Room updated successfully.', room });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Error editing room.', error: error.message });
  }
};

// Delete a Room
export const deleteRoom = async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    const room = await Room.findById(id);
    if (!room) {
      return res.status(404).json({ message: 'Room not found.' });
    }

    // Remove references
    await Hospital.findByIdAndUpdate(
      room.hospital,
      { $pull: { rooms: id } },
      { session }
    );

    await Department.findByIdAndUpdate(
      room.department,
      { $pull: { rooms: id } },
      { session }
    );

    if (room.assignedDoctor) {
      await Doctor.findByIdAndUpdate(
        room.assignedDoctor,
        { $pull: { assignedRooms: id } },
        { session }
      );
    }

    await Room.findByIdAndDelete(id, { session });
    await session.commitTransaction();
    session.endSession();

    res.status(200).json({ message: 'Room deleted successfully.' });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: 'Error deleting room.', error: error.message });
  }
};
