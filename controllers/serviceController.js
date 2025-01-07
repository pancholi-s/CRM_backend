import mongoose from 'mongoose';
import Service from "../models/serviceModel.js";
import Hospital from "../models/hospitalModel.js"; // Import the Hospital model

export const addService = async (req, res) => {
  const { name, description, category, rateType, rate, effectiveDate, amenities } = req.body;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    const existingService = await mongoose.model("Service").findOne({ name, createdBy: hospitalId });

    if (existingService) {
      // Add sub-category to existing service
      existingService.categories.push({ category, rateType, rate, effectiveDate, amenities });
      await existingService.save();
      res.status(200).json({ message: "Sub-category added successfully.", service: existingService });
    } else {
      // Create new service
      const newService = new mongoose.model("Service")({
        name,
        description,
        categories: [{ category, rateType, rate, effectiveDate, amenities }],
        createdBy: hospitalId,
      });

      await newService.save();

      // Update the hospital's services array
      await mongoose.model("Hospital").findByIdAndUpdate(
        hospitalId,
        { $push: { services: newService._id } },
        { new: true }
      );

      res.status(201).json({ message: "Service added successfully.", service: newService });
    }
  } catch (error) {
    res.status(500).json({ message: "Error adding service.", error: error.message });
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