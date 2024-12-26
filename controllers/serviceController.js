import Service from "../models/serviceModel.js";
import Hospital from "../models/hospitalModel.js"; // Import the Hospital model

// Add Service
export const addService = async (req, res) => {
  const { name, description, price } = req.body;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    const newService = new Service({
      name,
      description,
      price,
      createdBy: hospitalId,
    });
    await newService.save();

    // Update the hospital's services array
    await Hospital.findByIdAndUpdate(
      hospitalId,
      { $push: { services: newService._id } },
      { new: true }
    );

    res
      .status(201)
      .json({ message: "Service added successfully.", service: newService });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error adding service.", error: error.message });
  }
};

// Get Services
export const getServices = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res
        .status(403)
        .json({ message: "Unauthorized access. No hospital context." });
    }

    const services = await Service.find({ createdBy: hospitalId });
    res.status(200).json({ services });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching services.", error: error.message });
  }
};