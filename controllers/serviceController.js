import Service from "../models/serviceModel.js";
import Hospital from "../models/hospitalModel.js";
import Department from "../models/departmentModel.js";

export const addService = async (req, res) => {
  const { name, description, category, rateType, rate, effectiveDate, amenities, departmentNames } = req.body;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    // Find the department IDs based on the provided department names
    const departments = await Department.find({
      name: { $in: departmentNames },
      hospital: hospitalId, // Ensure departments belong to the current hospital
    });

    if (!departments.length) {
      return res.status(404).json({ message: "No matching departments found." });
    }

    const departmentIds = departments.map((dept) => dept._id);

    // Check if the service with the same name already exists for the hospital
    const existingService = await Service.findOne({ name, createdBy: hospitalId });

    if (existingService) {
      // Add sub-category to the existing service
      existingService.categories.push({ category, rateType, rate, effectiveDate, amenities });
      existingService.department.push(...departmentIds); // Add department references if not already present
      existingService.department = [...new Set(existingService.department.map(String))]; // Ensure unique department IDs
      await existingService.save();

      // Add the service to the departments' services array
      await Department.updateMany(
        { _id: { $in: departmentIds } },
        { $addToSet: { services: existingService._id } } // Use $addToSet to avoid duplicates
      );

      return res.status(200).json({
        message: "Sub-category and department references added successfully.",
        service: existingService,
      });
    }

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
    await Department.updateMany(
      { _id: { $in: departmentIds } },
      { $push: { services: newService._id } }
    );

    res.status(201).json({
      message: "Service added successfully and linked to departments.",
      service: newService,
    });
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