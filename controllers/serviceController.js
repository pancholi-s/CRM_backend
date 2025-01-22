import Service from "../models/serviceModel.js";
import Hospital from "../models/hospitalModel.js";
import Department from '../models/departmentModel.js';

export const addService = async (req, res) => {
  const { name, description, category, rateType, rate, effectiveDate, amenities, departmentIds } = req.body;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    // Check if the service with the same name already exists for the hospital
    const existingService = await Service.findOne({ name, createdBy: hospitalId });

    if (existingService) {
      // Add sub-category to the existing service
      existingService.categories.push({ category, rateType, rate, effectiveDate, amenities });
      await existingService.save();

      res.status(200).json({ message: "Sub-category added successfully.", service: existingService });
    } else {
      // Create a new service
      const newService = new Service({
        name,
        description,
        categories: [{ category, rateType, rate, effectiveDate, amenities }],
        createdBy: hospitalId,
        department: departmentIds, // Add department IDs to the service
      });

      await newService.save();

      // Push the new service ID into the hospital's services array
      await Hospital.findByIdAndUpdate(
        hospitalId,
        { $push: { services: newService._id } },
        { new: true }
      );

      // Push the new service ID into the specified departments' services array
      if (departmentIds && departmentIds.length > 0) {
        await Department.updateMany(
          { _id: { $in: departmentIds } },
          { $push: { services: newService._id } }
        );
      }

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