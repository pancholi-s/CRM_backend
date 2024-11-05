import Receptionist from "../models/receptionistModel.js";

// Get all receptionists
export const getReceptionists = async (req, res) => {
  try {
    const receptionists = await Receptionist.find().populate(
      "appointmentsHandled"
    );
    res.status(200).json(receptionists);
  } catch (error) {
    console.error("Error fetching receptionists:", error); // Log the error
    res.status(500).json({ message: "Error fetching receptionists." });
  }
};