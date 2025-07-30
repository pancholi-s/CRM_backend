import Patient from "../models/patientModel.js";
import Room from "../models/roomModel.js";
import Bed from "../models/bedModel.js"; // Only if beds are in a separate collection

export const getHospitalStats = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "Unauthorized. Hospital ID missing." });
    }

    // Total patients count
    const totalPatients = await Patient.countDocuments({ hospital: hospitalId });

    // Rooms having at least one available bed
    const rooms = await Room.find({ hospital: hospitalId })
      .populate({
        path: "beds",
        match: { status: "Available" },
        select: "_id status"
      })
      .lean();

    // Available rooms (with at least one available bed)
    const availableRooms = rooms.filter((room) => room.beds && room.beds.length > 0);

    // Available beds count across hospital
    const availableBedsCount = availableRooms.reduce((sum, room) => sum + room.beds.length, 0);

    return res.status(200).json({
      message: "Hospital statistics fetched successfully.",
      stats: {
        totalPatients,
        availableRooms: availableRooms.length,
        availableBeds: availableBedsCount
      }
    });
  } catch (error) {
    console.error("Error fetching hospital stats:", error);
    return res.status(500).json({
      message: "Error fetching hospital statistics",
      error: error.message
    });
  }
};
