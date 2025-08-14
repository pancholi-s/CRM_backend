import InsuranceCompany from '../models/insuranceCompanyModel.js';

// Add a new insurance company
export const addInsuranceCompany = async (req, res) => {
  try {
    const { id, name, services } = req.body;
    const hospitalId = req.session.hospitalId;  // Automatically fetch hospitalId from session
    const createdBy = req.user._id; // Assuming the user ID is available in `req.user`

    if (!id || !name || !services || !hospitalId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const newInsuranceCompany = new InsuranceCompany({
      id,
      name,
      services,
      hospitalId,  // Automatically associated with the hospital from the session
      createdBy,
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
    const { companyId } = req.params; // The ID of the insurance company
    const { serviceName, pricingDetails } = req.body; // Service details to be added
    
    if (!serviceName || !pricingDetails) {
      return res.status(400).json({ message: "Service name and pricing details are required." });
    }

    // Find the insurance company by ID
    const company = await InsuranceCompany.findById(companyId);

    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    // Add the new service to the services array
    company.services.push({ serviceName, pricingDetails });

    // Save the updated company document
    await company.save();

    res.status(200).json({ message: "Service added successfully", company });
  } catch (error) {
    res.status(500).json({ message: "Error adding service to insurance company.", error: error.message });
  }
};


// Get all insurance companies
export const getInsuranceCompanies = async (req, res) => {
  try {
    const companies = await InsuranceCompany.find();
    res.status(200).json({ message: "Insurance companies fetched successfully", companies });
  } catch (error) {
    res.status(500).json({ message: "Error fetching insurance companies.", error: error.message });
  }
};

// Get details of a specific insurance company
export const getInsuranceCompanyDetails = async (req, res) => {
  try {
    const { id } = req.params;
    const company = await InsuranceCompany.findOne({ id });

    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    res.status(200).json({ message: "Insurance company details fetched successfully", company });
  } catch (error) {
    res.status(500).json({ message: "Error fetching insurance company details.", error: error.message });
  }
};
