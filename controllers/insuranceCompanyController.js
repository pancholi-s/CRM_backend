import InsuranceCompany from '../models/insuranceCompanyModel.js';
import mongoose from 'mongoose';

// Add a new insurance company
export const addInsuranceCompany = async (req, res) => {
  try {
    const { id, name, services } = req.body;
    const hospitalId = req.session.hospitalId;
    const createdBy = req.user._id;

    if (!id || !name || !hospitalId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const newInsuranceCompany = new InsuranceCompany({
      id,
      name,
      services: services || [], // Optional initial services
      hospitalId,
      createdBy
    });

    await newInsuranceCompany.save();
    res.status(201).json({ message: "Insurance company added successfully", company: newInsuranceCompany });
  } catch (error) {
    res.status(500).json({ message: "Error adding insurance company.", error: error.message });
  }
};

// Add a new service to an existing insurance company
export const addServiceToCompany = async (req, res) => {
  try {
    const { companyId } = req.params;
    const { serviceName, categories } = req.body;

    if (!serviceName || !categories || !Array.isArray(categories) || categories.length === 0) {
      return res.status(400).json({ message: "Service name and categories are required, with at least one category." });
    }

    const company = await InsuranceCompany.findById(companyId);
    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    // Check if the service already exists
    const existingService = company.services.find(s => s.serviceName === serviceName);
    if (existingService) {
      // Add new categories or update existing ones
      categories.forEach(newCategory => {
        const existingCategory = existingService.categories.find(c => c.subCategoryName === newCategory.subCategoryName);
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
    res.status(200).json({ message: "Service added/updated successfully", company });

  } catch (error) {
    res.status(500).json({ message: "Error adding service to insurance company.", error: error.message });
  }
};

// Get all insurance companies
export const getInsuranceCompanies = async (req, res) => {
  try {
    const companies = await InsuranceCompany.find().lean();
    res.status(200).json({ message: "Insurance companies fetched successfully", companies });
  } catch (error) {
    res.status(500).json({ message: "Error fetching insurance companies.", error: error.message });
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

    res.status(200).json({ message: "Insurance company details fetched successfully", company });
  } catch (error) {
    res.status(500).json({ message: "Error fetching insurance company details.", error: error.message });
  }
};

// Edit an existing service in an insurance company
export const editServiceInCompany = async (req, res) => {
  try {
    const { companyId, serviceName, categories } = req.body;

    if (!companyId || !serviceName || !categories) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const company = await InsuranceCompany.findById(companyId);
    if (!company) return res.status(404).json({ message: "Insurance company not found." });

    const service = company.services.find(s => s.serviceName === serviceName);
    if (!service) return res.status(404).json({ message: "Service not found in this insurance company." });

    categories.forEach(newCategory => {
      const existingCategory = service.categories.find(c => c.subCategoryName === newCategory.subCategoryName);
      if (existingCategory) {
        Object.assign(existingCategory, newCategory);
      } else {
        service.categories.push(newCategory);
      }
    });

    await company.save();
    res.status(200).json({ message: "Service updated successfully", company });

  } catch (error) {
    res.status(500).json({ message: "Error updating service.", error: error.message });
  }
};

// Delete a category from a service in insurance company
export const deleteCategoryFromService = async (req, res) => {
  try {
    const { companyId, serviceName, subCategoryName } = req.body;

    if (!companyId || !serviceName || !subCategoryName) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const company = await InsuranceCompany.findById(companyId);
    if (!company) return res.status(404).json({ message: "Insurance company not found." });

    const service = company.services.find(s => s.serviceName === serviceName);
    if (!service) return res.status(404).json({ message: "Service not found in insurance company." });

    service.categories = service.categories.filter(c => c.subCategoryName !== subCategoryName);

    await company.save();
    res.status(200).json({ message: "Category deleted successfully", company });

  } catch (error) {
    res.status(500).json({ message: "Error deleting category.", error: error.message });
  }
};
