import Service from "../models/serviceModel.js";
import Hospital from "../models/hospitalModel.js";
import Department from "../models/departmentModel.js";

export const addService = async (req, res) => {
  const { name, description, subCategoryName, rateType, rate, effectiveDate, amenities, departmentName } = req.body;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    // Ensure departments belong to the current hospital
    const department = await Department.findOne({
      name: departmentName,
      hospital: hospitalId,
    });

    if (!department) {
      return res.status(404).json({ message: "No matching departments found." });
    }

    const existingService = await Service.findOne({ name, department: department._id });

    if (existingService) {
      // Check if the subcategory already exists in the service
      const subCategoryExists = existingService.categories.some(
        (cat) => cat.subCategoryName === subCategoryName
      );

      if (subCategoryExists) {
        return res.status(400).json({ message: "Subcategory already exists in this service." });
      }

      // Add new subcategory to the existing service
      existingService.categories.push({ subCategoryName, rateType, rate, effectiveDate, amenities });
      existingService.lastUpdated = new Date();
      await existingService.save();

      // Populate department name before sending response
      const populatedService = await Service.findById(existingService._id)
        .populate("department", "name")
        .lean();

      return res.status(200).json({
        message: "Subcategory added successfully to the existing service.",
        service: populatedService,
      });
    }

    // Create a new service
    const newService = new Service({
      name,
      description,
      categories: [{ subCategoryName, rateType, rate, effectiveDate, amenities }],
      createdBy: hospitalId,
      department: department._id,
    });

    await newService.save();

    // Push the new service ID into the specified departments' services array
    await Department.findByIdAndUpdate(
      department._id,
      { $push: { services: newService._id } }
    );

    // Fetch the newly created service along with the department name
    const populatedNewService = await Service.findById(newService._id)
      .populate("department", "name")
      .lean();

    res.status(201).json({
      message: "Service added successfully and linked to departments.",
      service: populatedNewService,
    });
  } catch (error) {
    res.status(500).json({ message: "Error adding service.", error: error.message });
  }
};

// Get Services
export const getServices = async (req, res) => {
  try {
    const { departmentId } = req.query;   //optional query parameter

    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "Unauthorized access. No hospital context." });
    }

    // Build query filter (optional)
    const filter = { createdBy: hospitalId };
    if (departmentId) filter.department = departmentId;

    const services = await Service.find(filter).populate("department", "name");

    res.status(200).json({ services });
  } catch (error) {
    res.status(500).json({ message: "Error fetching services.", error: error.message });
  }
};