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
      existingService.categories.push({ subCategoryName, rateType, rate, effectiveDate, amenities, hospital: hospitalId });
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
      categories: [{ subCategoryName, rateType, rate, effectiveDate, amenities, hospital: hospitalId, }],
      hospital: hospitalId,
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

export const getServices = async (req, res) => {
  try {
    const { departmentId, name } = req.query;

    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "Unauthorized access. No hospital context." });
    }

    // Build query filter
    const filter = { hospital: hospitalId };

    if (departmentId) filter.department = departmentId;

    if (name) filter.name = name;

    const services = await Service.find(filter).populate("department", "name");

    res.status(200).json({ services });
  } catch (error) {
    res.status(500).json({ message: "Error fetching services.", error: error.message });
  }
};

export const editService = async (req, res) => {
  const { serviceId, name, description, revenueType, categories } = req.body;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    const service = await Service.findOne({ _id: serviceId, hospital: hospitalId });

    if (!service) {
      return res.status(404).json({ message: "Service not found or access denied." });
    }

    // Update service details
    if (name) service.name = name;
    if (description) service.description = description;
    if (revenueType) service.revenueType = revenueType;

    // Update existing categories or add new ones
    if (categories && Array.isArray(categories)) {
      categories.forEach((newCategory) => {
        const existingCategory = service.categories.find(
          (cat) => cat._id.toString() === newCategory._id
        );

        if (existingCategory) {
          // Update existing category
          Object.assign(existingCategory, newCategory);
        } else {
          // Add new category
          service.categories.push({ ...newCategory, hospital: hospitalId });
        }
      });
    }

    service.lastUpdated = new Date();
    await service.save();

    const updatedService = await Service.findById(serviceId).populate("department", "name");

    res.status(200).json({ message: "Service updated successfully.", service: updatedService });
  } catch (error) {
    res.status(500).json({ message: "Error updating service.", error: error.message });
  }
};

export const deleteService = async (req, res) => {
  const { serviceId } = req.params;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    const service = await Service.findOneAndDelete({ _id: serviceId, hospital: hospitalId });

    if (!service) {
      return res.status(404).json({ message: "Service not found or access denied." });
    }

    // Remove service reference from the department
    await Department.findByIdAndUpdate(service.department, { $pull: { services: serviceId } });

    res.status(200).json({ message: "Service deleted successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error deleting service.", error: error.message });
  }
};

export const deleteSubcategory = async (req, res) => {
  const { serviceId, subcategoryId } = req.params;
  const hospitalId = req.session.hospitalId; 

  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    // Find the service
    const service = await Service.findOne({ _id: serviceId, hospital: hospitalId });

    if (!service) {
      return res.status(404).json({ message: "Service not found or access denied." });
    }

    // Check if subcategory exists
    const categoryIndex = service.categories.findIndex(
      (cat) => cat._id.toString() === subcategoryId
    );

    if (categoryIndex === -1) {
      return res.status(404).json({ message: "Subcategory not found." });
    }

    // Remove the subcategory
    service.categories.splice(categoryIndex, 1);
    service.lastUpdated = new Date();
    await service.save();

    res.status(200).json({ message: "Subcategory deleted successfully.", service });
  } catch (error) {
    res.status(500).json({ message: "Error deleting subcategory.", error: error.message });
  }
};
