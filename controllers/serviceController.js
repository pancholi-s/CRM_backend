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
    departmentNames,
    departmentIds,
    additionaldetails,
  } = req.body;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    // ✅ Fetch valid departments
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

    const deptIds = targetDepts.map(d => d._id);

    // ✅ Find service by hospital and name
    let service = await Service.findOne({ hospital: hospitalId, name });

    if (!service) {
      // ✅ Create new service
      const categories = [{
        subCategoryName,
        rateType,
        rate,
        effectiveDate,
        amenities,
        departments: deptIds, // ✅ all departments together
        additionaldetails: additionaldetails || null,
        hospital: hospitalId,
      }];

      service = new Service({
        name,
        description,
        hospital: hospitalId,
        departments: deptIds,
        categories,
      });
      await service.save();
    } else {
      // ✅ Look for existing subcategory+rate match
      const existingCategory = service.categories.find(
        c => c.subCategoryName === subCategoryName && c.rate === rate
      );

      if (existingCategory) {
        // ✅ merge departments
        existingCategory.departments = [...new Set([...existingCategory.departments, ...deptIds])];
      } else {
        // ✅ add one new combined category
        service.categories.push({
          subCategoryName,
          rateType,
          rate,
          effectiveDate,
          amenities,
          departments: deptIds, // ✅ not looping
          additionaldetails: additionaldetails || null,
          hospital: hospitalId,
        });
      }

      service.lastUpdated = new Date();
      await service.save();
    }

    // ✅ Link service to all departments
    await Department.updateMany(
      { _id: { $in: deptIds } },
      { $addToSet: { services: service._id } }
    );

    const populatedService = await Service.findById(service._id)
      .populate("departments", "name")
      .populate({ path: "categories.departments", select: "name" })
      .lean();

    return res.status(201).json({
      message: "Service added/updated successfully.",
      service: populatedService,
    });
  } catch (error) {
    return res.status(500).json({
      message: "Error adding service.",
      error: error.message,
    });
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
      .populate("departments", "name")
      .populate({
        path: "categories.departments", // ✅ nested populate inside categories
        select: "name",                 // only get department name
      })
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
  const { serviceId } = req.params; // Main service ID
  const { name, description, revenueType, categories } = req.body;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Unauthorized access. No hospital context." });
  }

  try {
    // 🔍 Find the main service by ID and hospital
    const service = await Service.findOne({
      _id: serviceId,
      hospital: hospitalId,
    });

    if (!service) {
      return res
        .status(404)
        .json({ message: "Service not found or access denied." });
    }

    // ✅ Update top-level service fields
    if (name) service.name = name;
    if (description) service.description = description;
    if (revenueType) service.revenueType = revenueType;

    // ✅ Handle categories array updates
    if (Array.isArray(categories) && categories.length > 0) {
      for (const catUpdate of categories) {
        const { _id, subCategoryName, rate, rateType, amenities, additionaldetails } =
          catUpdate;

        // Find category by its _id
        const existingCategory = service.categories.id(_id);

        if (existingCategory) {
          // ✅ Update existing category fields
          if (subCategoryName)
            existingCategory.subCategoryName = subCategoryName;
          if (rate) existingCategory.rate = parseInt(rate);
          if (rateType) existingCategory.rateType = rateType;
          if (amenities) existingCategory.amenities = amenities;
          if (additionaldetails !== undefined)
            existingCategory.additionaldetails = additionaldetails;
        } else {
          // ✅ Add as new category if not found
          service.categories.push({
            subCategoryName,
            rateType,
            rate: parseInt(rate) || 0,
            amenities: amenities || "N/A",
            additionaldetails: additionaldetails || null,
            hospital: hospitalId,
          });
        }
      }
    }

    service.lastUpdated = new Date();
    await service.save();

    // ✅ Populate related fields for response
    const updatedService = await Service.findById(service._id)
      .populate("departments", "name")
      .populate("hospital", "name")
      .populate({ path: "categories.departments", select: "name" })
      .lean();

    res.status(200).json({
      message: "Service updated successfully.",
      service: updatedService,
    });
  } catch (error) {
    console.error("❌ Error updating service:", error);
    res.status(500).json({
      message: "Error updating service.",
      error: error.message,
    });
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
      .sort({ createdAt: -1 })
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
