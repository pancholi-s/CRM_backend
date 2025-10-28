import Service from "../models/serviceModel.js";
import Department from "../models/departmentModel.js";
import Hospital from "../models/hospitalModel.js";

export const addService = async (req, res) => {
  const {
    name,
    description,
    subCategoryName,
    rateType,
    rate,
    effectiveDate,
    amenities,
    departmentNames,  // List of department names
    departmentIds,    // Or multiple department IDs
    additionaldetails, // Only for room services
  } = req.body;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    // Ensure the departments belong to the current hospital
    const deptFilter = { hospital: hospitalId };
    let targetDepts = [];

    if (Array.isArray(departmentIds) && departmentIds.length) {
      targetDepts = await Department.find({ ...deptFilter, _id: { $in: departmentIds } }).lean();
    } else if (Array.isArray(departmentNames) && departmentNames.length) {
      targetDepts = await Department.find({ ...deptFilter, name: { $in: departmentNames } }).lean();
    }

    if (!targetDepts.length) {
      return res.status(404).json({ message: "No matching departments found." });
    }

    const deptIds = targetDepts.map(d => d._id); // Get all department IDs for the service

    // Find if the service already exists
    let service = await Service.findOne({ hospital: hospitalId, name });

    if (!service) {
      // Create new service if it doesn't exist
      const categories = [{
        subCategoryName,
        rateType,
        rate,  // Use the same rate for now
        effectiveDate,
        amenities,
        departments: deptIds, // All departments are linked here
        additionaldetails: additionaldetails || null,
        hospital: hospitalId,
      }];

      service = new Service({
        name,
        description,
        hospital: hospitalId,
        departments: deptIds, // Add all departments here
        categories,
      });
      await service.save();
    } else {
      // If the service exists, check if the subCategoryName already exists and manage rate logic
      const existingCategory = service.categories.find(  c => c.subCategoryName === subCategoryName && c.rate === rate);

      if (existingCategory) {
        // If the rate is the same for multiple departments, we add the department to the existing subcategory
        if (existingCategory.rate === rate) {
          // Add all departments to the same category
          existingCategory.departments = [...new Set([...existingCategory.departments, ...deptIds])]; // Prevent duplicates
        } else {
          // If the rate is different for each department, create separate entries for each department
          targetDepts.forEach(department => {
            service.categories.push({
              subCategoryName,
              rateType,
              rate,
              effectiveDate,
              amenities,
              departments: [department._id],
              additionaldetails: additionaldetails || null,
              hospital: hospitalId,
            });
          });
        }
        service.lastUpdated = new Date();
        await service.save();
      } else {
        // Add new category for each department if the subcategory doesn't exist yet
        targetDepts.forEach(department => {
          service.categories.push({
            subCategoryName,
            rateType,
            rate,
            effectiveDate,
            amenities,
            departments: [department._id],
            additionaldetails: additionaldetails || null,
            hospital: hospitalId,
          });
        });
        service.lastUpdated = new Date();
        await service.save();
      }
    }

    // Link the service to the departments in the top-level departments array
    await Department.updateMany(
      { _id: { $in: deptIds } },
      { $addToSet: { services: service._id } }
    );

    // Populate all departments and the service details
    const populatedService = await Service.findById(service._id)
      .populate("departments", "name")  // Populate multiple departments
      .lean();

    return res.status(201).json({
      message: service ? "Service added/updated successfully." : "Service created successfully.",
      service: populatedService,
    });
  } catch (error) {
    return res.status(500).json({ message: "Error adding service.", error: error.message });
  }
};




export const getServices = async (req, res) => {
  try {
    const { departmentId, name, page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res
        .status(403)
        .json({ message: "Unauthorized access. No hospital context." });
    }

    // Build query filter
    const filter = { hospital: hospitalId };

    if (departmentId) filter.department = departmentId;

    if (name) filter.name = name;

    const total = await Service.countDocuments(filter);

    const services = await Service.find(filter)
      .populate("department", "name")
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      message: "Services retrieved successfully .",
      count: services.length,
      totalServices: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      services,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching services.", error: error.message });
  }
};

export const editService = async (req, res) => {
  const { serviceId } = req.params;
  const { name, description, revenueType, categories, rate, subCategoryName } = req.body;
  
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    const service = await Service.findOne({
      _id: serviceId,
      hospital: hospitalId,
    });

    if (!service) {
      return res
        .status(404)
        .json({ message: "Service not found or access denied." });
    }

    // Update service details
    if (name) service.name = name;
    if (description) service.description = description;
    if (revenueType) service.revenueType = revenueType;

    // Handle direct rate update (for simple rate changes)
    if (rate && !categories) {
      if (subCategoryName) {
        const categoryToUpdate = service.categories.find(
          cat => cat.subCategoryName === subCategoryName
        );
        if (categoryToUpdate) {
          categoryToUpdate.rate = parseInt(rate);
        } else {
          return res.status(404).json({ 
            message: `Subcategory '${subCategoryName}' not found.` 
          });
        }
      } else if (service.categories.length > 0) {
        service.categories[0].rate = parseInt(rate);
      }
    }

    // Handle categories array updates
    if (categories && Array.isArray(categories)) {
      categories.forEach((newCategory) => {
        if (newCategory._id) {
          // Update existing category
          const existingCategory = service.categories.find(
            (cat) => cat._id.toString() === newCategory._id
          );

          if (existingCategory) {
            Object.keys(newCategory).forEach(key => {
              if (key !== '_id' && newCategory[key] !== undefined) {
                if (key === 'rate') {
                  existingCategory[key] = parseInt(newCategory[key]);
                } else {
                  existingCategory[key] = newCategory[key];
                }
              }
            });
          }
        } else {
          // Add new category
          const categoryToAdd = { ...newCategory, hospital: hospitalId };
          if (categoryToAdd.rate) {
            categoryToAdd.rate = parseInt(categoryToAdd.rate);
          }
          service.categories.push(categoryToAdd);
        }
      });
    }

    service.lastUpdated = new Date();
    await service.save();

    const updatedService = await Service.findById(serviceId)
      .populate("department", "name")
      .populate("hospital", "name");

    res.status(200).json({
      message: "Service updated successfully.",
      service: updatedService,
    });
    
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error updating service.", error: error.message });
  }
};

export const deleteService = async (req, res) => {
  const { serviceId } = req.params;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    const service = await Service.findOneAndDelete({
      _id: serviceId,
      hospital: hospitalId,
    });

    if (!service) {
      return res
        .status(404)
        .json({ message: "Service not found or access denied." });
    }

    // Remove service reference from the department
    await Department.findByIdAndUpdate(service.department, {
      $pull: { services: serviceId },
    });

    res.status(200).json({ message: "Service deleted successfully." });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting service.", error: error.message });
  }
};

export const deleteSubcategory = async (req, res) => {
  const { serviceId, subcategoryId } = req.params;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    // Find the service
    const service = await Service.findOne({
      _id: serviceId,
      hospital: hospitalId,
    });

    if (!service) {
      return res
        .status(404)
        .json({ message: "Service not found or access denied." });
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

    res
      .status(200)
      .json({ message: "Subcategory deleted successfully.", service });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting subcategory.", error: error.message });
  }
};

export const getPackages = async (req, res) => {
  try {
    const packages = await Service.find({ name: "Packages" })
      .populate("hospital", "name address")     // optional populate
      .populate("department", "name");          // optional populate

    if (!packages || packages.length === 0) {
      return res.status(404).json({ message: "No packages found" });
    }

    res.status(200).json(packages);
  } catch (error) {
    console.error("Error fetching packages:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};

export const getServicesByDep = async (req, res) => {
  try {
    const { id: departmentId } = req.params;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res
        .status(403)
        .json({ message: "Unauthorized access. No hospital context." });
    }

    const department = await Department.findOne({
      _id: departmentId,
      hospital: hospitalId,
    })

    if (!department) {
      return res.status(404).json({ message: "Department not found." });
    }

    const totalServices = await Service.countDocuments({
      department: departmentId,
      hospital: hospitalId,
    })

    const services = await Service.find({
      department: departmentId,
      hospital: hospitalId,
    })
      .select("name description categories lastUpdated revenueType")
      .sort({ createdAt: -1})
      .lean();

    const response = {
      departmentId: department._id,
      departmentName: department.name,
      totalServices,
      services: services.map((s) => ({
        id: s._id,
        name: s.name,
        description: s.description,
        categories: s.categories.map((cat) => ({
          subCategoryName: cat.subCategoryName,
          rateType: cat.rateType,
          rate: cat.rate,
          effectiveDate: cat.effectiveDate,
          amenities: cat.amenities,
          additionaldetails: cat.additionaldetails,
        })),
        lastUpdated: s.lastUpdated,
        revenueType: s.revenueType,
      })),
    };

    res.status(200).json(response);
  } catch (error) {
    console.error("Error fetching department details:", error);
    res
      .status(500)
      .json({ message: "Error fetching department details.", error: error.message });
  }
};
