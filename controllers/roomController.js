import mongoose from 'mongoose';
import Room from '../models/roomModel.js';
import Hospital from '../models/hospitalModel.js';
import Department from '../models/departmentModel.js';
import Doctor from '../models/doctorModel.js';

// Add a new Room
export const addRoom = async (req, res) => {
  const { roomID, name, doctorId, status } = req.body;

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

    // Validate doctor
    if (!doctorId) {
      return res.status(400).json({ message: 'Doctor ID is required to assign a room.' });
    }

    const doctor = await Doctor.findById(doctorId);
    if (!doctor || !hospital.doctors.includes(doctorId)) {
      return res.status(404).json({ message: 'Doctor not found in the specified hospital.' });
    }

    // Fetch department from the doctor
    if (!doctor.departments || doctor.departments.length === 0) {
      return res.status(400).json({ message: 'Doctor is not assigned to any department.' });
    }

    const departmentId = doctor.departments[0]; // Assuming the first department is the primary one

    // Validate department
    const department = await Department.findById(departmentId);
    if (!department || !hospital.departments.includes(departmentId)) {
      return res.status(404).json({ message: 'Department not found in the specified hospital.' });
    }

    // Create Room
    const newRoom = new Room({
      roomID,
      name,
      hospital: hospitalId,
      department: departmentId, // Automatically assigned from doctor
      assignedDoctor: doctorId,
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

    await Doctor.findByIdAndUpdate(
      doctorId,
      { $push: { assignedRooms: newRoom._id } },
      { session }
    );

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
