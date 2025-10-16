import InsuranceCompany from "../models/insuranceCompanyModel.js";
import mongoose from "mongoose";
import AdmissionRequest from "../models/admissionReqModel.js";
import Service from "../models/serviceModel.js";


// Add a new insurance company
export const addInsuranceCompany = async (req, res) => {
  try {
    const { id, name } = req.body;
    const hospitalId = req.session.hospitalId;
    const createdBy = req.user._id;

    if (!id || !name || !hospitalId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // 1. Fetch all services of the hospital
    const hospitalServices = await Service.find({ hospital: hospitalId }).lean();

    // 2. Map them into the insurance company structure
    const servicesForInsurance = hospitalServices.map(service => ({
      serviceName: service.name,
      categories: service.categories.map(cat => ({
        subCategoryName: cat.subCategoryName,
        rateType: cat.rateType,
        rate: cat.rate,                  // initial = same as hospital rate
        effectiveDate: cat.effectiveDate,
        amenities: cat.amenities || "N/A",
        additionaldetails: cat.additionaldetails || null
      }))
    }));

    // 3. Create insurance company with all services cloned
    const newInsuranceCompany = new InsuranceCompany({
      id,
      name,
      services: servicesForInsurance,
      hospitalId,
      createdBy,
    });

    await newInsuranceCompany.save();

    res.status(201).json({
      message: "Insurance company added successfully with all hospital services.",
      company: newInsuranceCompany,
    });
  } catch (error) {
    console.error("Error adding insurance company:", error);
    res.status(500).json({
      message: "Error adding insurance company.",
      error: error.message,
    });
  }
};


// Add a new service to an existing insurance company
export const addServiceToCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { serviceName, categories } = req.body;

    if (
      !serviceName ||
      !categories ||
      !Array.isArray(categories) ||
      categories.length === 0
    ) {
      return res.status(400).json({
        message:
          "Service name and categories are required, with at least one category.",
      });
    }

    const company = await InsuranceCompany.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    // Check if the service already exists
    const existingService = company.services.find(
      (s) => s.serviceName === serviceName
    );
    if (existingService) {
      // Add new categories or update existing ones
      categories.forEach((newCategory) => {
        const existingCategory = existingService.categories.find(
          (c) => c.subCategoryName === newCategory.subCategoryName
        );
        if (existingCategory) {
          // Update existing category
          Object.assign(existingCategory, newCategory);
        } else {
          // Add new category
          existingService.categories.push(newCategory);
        }
      });
    } else {
      // Add the new service with categories
      company.services.push({ serviceName, categories });
    }

    await company.save();
    res
      .status(200)
      .json({ message: "Service added/updated successfully", company });
  } catch (error) {
    res.status(500).json({
      message: "Error adding service to insurance company.",
      error: error.message,
    });
  }
};

// Get all insurance companies
export const getInsuranceCompanies = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res
        .status(403)
        .json({ message: "Unauthorized access. No hospital context." });
    }

    // ✅ Fetch insurance companies for this hospital
    const companies = await InsuranceCompany.find({ hospitalId }).lean();

    if (!companies.length) {
      return res.status(404).json({
        message: "No insurance companies found for this hospital.",
      });
    }

    res.status(200).json({
      message: "Insurance companies fetched successfully.",
      companies,
    });
  } catch (error) {
    console.error("❌ Error fetching insurance companies:", error);
    res.status(500).json({
      message: "Error fetching insurance companies.",
      error: error.message,
    });
  }
};



// Get a specific insurance company by ID
export const getInsuranceCompanyDetails = async (req, res) => {
  try {
    const { companyId } = req.params;
    const company = await InsuranceCompany.findById(companyId).lean();

    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    res.status(200).json({
      message: "Insurance company details fetched successfully",
      company,
    });
  } catch (error) {
    res.status(500).json({
      message: "Error fetching insurance company details.",
      error: error.message,
    });
  }
};

export const editServiceCategory = async (req, res) => {
  const { companyId, serviceId, categoryId } = req.params;
  const { service: serviceData, category: categoryData } = req.body;

  try {
    if (!companyId || !serviceId || !categoryId) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    const company = await InsuranceCompany.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    const service = company.services.id(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found." });
    }

    const category = service.categories.id(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    // Update service-level fields if provided
    if (serviceData && typeof serviceData === "object") {
      const serviceFields = ["serviceName"];

      Object.keys(serviceData).forEach((key) => {
        if (serviceFields.includes(key) && serviceData[key] !== undefined) {
          service[key] = serviceData[key];
        }
      });
    }

    // Update category-level fields if provided
    if (categoryData && typeof categoryData === "object") {
      const categoryFields = [
        "subCategoryName",
        "rateType",
        "rate",
        "effectiveDate",
        "amenities",
        "additionaldetails",
      ];

      Object.keys(categoryData).forEach((key) => {
        if (categoryFields.includes(key) && categoryData[key] !== undefined) {
          if (key === "rate") {
            category[key] = parseInt(categoryData[key]);
          } else if (key === "additionaldetails") {
            if (
              category.additionaldetails &&
              typeof categoryData[key] === "object"
            ) {
              let existingDetails;

              if (typeof category.additionaldetails.toObject === "function") {
                existingDetails = category.additionaldetails.toObject();
              } else {
                existingDetails = category.additionaldetails;
              }

              const updatedAdditionalDetails = {
                ...existingDetails,
                ...categoryData[key],
              };

              category.additionaldetails = updatedAdditionalDetails;

              category.markModified("additionaldetails");
            } else {
              category[key] = categoryData[key];
              category.markModified("additionaldetails");
            }
          } else {
            category[key] = categoryData[key];
          }
        }
      });

      Object.keys(categoryData).forEach((key) => {
        if (categoryFields.includes(key) && categoryData[key] !== undefined) {
          if (key === "rate") {
            category[key] = parseInt(categoryData[key]);
          } else if (key === "additionaldetails") {
            if (typeof categoryData[key] === "object") {
              // Overwrite completely with new object
              category.additionaldetails = categoryData[key];
              category.markModified("additionaldetails");
            } else {
              category[key] = categoryData[key];
              category.markModified("additionaldetails");
            }
          } else {
            category[key] = categoryData[key];
          }
        }
      });
    }

    service.lastUpdated = new Date();

    service.markModified("categories");
    company.markModified("services");

    await company.save();

    const updatedCompany = await InsuranceCompany.findById(companyId);

    res.status(200).json({
      message: "Service and category updated successfully",
      company: updatedCompany,
      updatedService: service,
      updatedCategory: category,
    });
  } catch (error) {
    console.error("Error updating service and category:", error);
    res.status(500).json({
      message: "Error updating service and category.",
      error: error.message,
    });
  }
};

// Delete a single category from a service
export const deleteSingleCategory = async (req, res) => {
  try {
    const { companyId, serviceId, categoryId } = req.params;

    if (!companyId || !serviceId || !categoryId) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    const company = await InsuranceCompany.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    const service = company.services.id(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found." });
    }

    const category = service.categories.id(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    // Remove the specific category
    category.deleteOne();

    await company.save();
    res.status(200).json({
      message: "Category deleted successfully",
      company,
      remainingCategories: service.categories.length,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error deleting category.", error: error.message });
  }
};

// Delete all categories from a service
export const deleteAllCategories = async (req, res) => {
  try {
    const { companyId, serviceId } = req.params;

    if (!companyId || !serviceId) {
      return res.status(400).json({ message: "Missing required parameters." });
    }

    const company = await InsuranceCompany.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    const service = company.services.id(serviceId);
    if (!service) {
      return res.status(404).json({ message: "Service not found." });
    }

    const deletedCategoriesCount = service.categories.length;

    service.deleteOne();

    await company.save();
    res.status(200).json({
      message: "All categories deleted successfully",
      company,
      deletedCategoriesCount,
    });
  } catch (error) {
    res
      .status(500)
      .json({
        message: "Error deleting all categories.",
        error: error.message,
      });
  }
};

export const updateAdmissionInsuranceDetails = async (req, res) => {
  try {
    const { admissionId } = req.params;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "Unauthorized: No hospital context." });
    }

    const {
      employerName,
      insuranceIdNumber,
      policyNumber,
      insuranceCompany,
      employeeCode,
      insuranceStartDate,
      insuranceExpiryDate,
      insuranceApproved,
      amountApproved
    } = req.body;

    // ✅ Validate status if provided
    const validStatuses = ["pending", "approved", "rejected"];
    if (insuranceApproved && !validStatuses.includes(insuranceApproved)) {
      return res.status(400).json({
        message: "Invalid insuranceApproved value. Must be 'pending', 'approved', or 'rejected'."
      });
    }

    // ✅ Find admission request
    const admissionRequest = await AdmissionRequest.findOne({
      _id: admissionId,
      hospital: hospitalId
    });

    if (!admissionRequest) {
      return res.status(404).json({ message: "Admission request not found." });
    }

    // ✅ Update fields dynamically
    if (admissionRequest.admissionDetails && admissionRequest.admissionDetails.insurance) {
      if (employerName !== undefined) admissionRequest.admissionDetails.insurance.employerName = employerName;
      if (insuranceIdNumber !== undefined) admissionRequest.admissionDetails.insurance.insuranceIdNumber = insuranceIdNumber;
      if (policyNumber !== undefined) admissionRequest.admissionDetails.insurance.policyNumber = policyNumber;
      if (insuranceCompany !== undefined) admissionRequest.admissionDetails.insurance.insuranceCompany = insuranceCompany;
      if (employeeCode !== undefined) admissionRequest.admissionDetails.insurance.employeeCode = employeeCode;
      if (insuranceStartDate !== undefined) admissionRequest.admissionDetails.insurance.insuranceStartDate = insuranceStartDate;
      if (insuranceExpiryDate !== undefined) admissionRequest.admissionDetails.insurance.insuranceExpiryDate = insuranceExpiryDate;
      if (insuranceApproved !== undefined) admissionRequest.admissionDetails.insurance.insuranceApproved = insuranceApproved;
      if (insuranceApproved !== undefined) admissionRequest.admissionDetails.insurance.amountApproved = amountApproved;
    }

    await admissionRequest.save();

    res.status(200).json({
      message: "Insurance details updated successfully",
      admissionRequest
    });
  } catch (error) {
    console.error("❌ Error updating insurance details:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};
