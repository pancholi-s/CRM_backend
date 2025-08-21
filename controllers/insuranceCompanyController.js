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
    const { services } = req.body; // An array of services to be added
    
    // Ensure that the services array is provided and is an array
    if (!Array.isArray(services) || services.length === 0) {
      return res.status(400).json({ message: "Services must be an array and cannot be empty." });
    }

    // Ensure that each service has a serviceName and pricingDetails
    for (let service of services) {
      if (!service.serviceName || !service.pricingDetails) {
        return res.status(400).json({ message: "Each service must have a serviceName and pricingDetails." });
      }
    }

    // Find the insurance company by ID
    const company = await InsuranceCompany.findById(companyId);

    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    // Add the new services to the services array
    company.services.push(...services);

    // Save the updated company document
    await company.save();

    res.status(200).json({ message: "Services added successfully", company });
  } catch (error) {
    res.status(500).json({ message: "Error adding services to insurance company.", error: error.message });
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

export const editServiceInCompany = async (req, res) => {
  try {
    const { companyId, serviceId } = req.params; 
    const { serviceName, pricingDetails, rate, description } = req.body; 

    if (!serviceName && !pricingDetails && !rate && !description) {
      return res.status(400).json({ 
        message: "At least one field (serviceName, pricingDetails, rate, or description) must be provided for update." 
      });
    }

    const company = await InsuranceCompany.findById(companyId);

    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    const service = company.services.id(serviceId);

    if (!service) {
      return res.status(404).json({ message: "Service not found in this insurance company." });
    }

    if (serviceName) {
      service.serviceName = serviceName;
    }

    if (pricingDetails) {
      service.pricingDetails = pricingDetails;
    } else if (rate !== undefined || description !== undefined) {
      if (typeof service.pricingDetails !== 'object' || service.pricingDetails === null) {
        service.pricingDetails = {};
      }
      
      if (rate !== undefined) {
        service.pricingDetails.rate = rate;
      }
      if (description !== undefined) {
        service.pricingDetails.description = description;
      }
    }

    await company.save();

    res.status(200).json({ 
      message: "Service updated successfully", 
      company,
      updatedService: service 
    });
  } catch (error) {
    res.status(500).json({ message: "Error updating service.", error: error.message });
  }
};

export const deleteServiceFromCompany = async (req, res) => {
  try {
    const { companyId, serviceId } = req.params;
    const company = await InsuranceCompany.findById(companyId);

    if (!company) {
      return res.status(404).json({ message: "Insurance company not found." });
    }

    const service = company.services.id(serviceId);

    if (!service) {
      return res.status(404).json({ message: "Service not found in this insurance company." });
    }

    const deletedService = {
      _id: service._id,
      serviceName: service.serviceName,
      pricingDetails: service.pricingDetails
    };

    company.services.pull(serviceId);

    await company.save();

    res.status(200).json({ 
      message: "Service deleted successfully", 
      company,
      deletedService 
    });
  } catch (error) {
    res.status(500).json({ message: "Error deleting service.", error: error.message });
  }
};