import express from 'express';
import { addInsuranceCompany,  addServiceToCompany , getInsuranceCompanies, getInsuranceCompanyDetails } from '../controllers/insuranceCompanyController.js';
import { requireHospitalContext } from '../middleware/hospitalContext.js';
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();
router.use(requireHospitalContext);

// Add a new insurance company
router.post('/addInsuranceCompany', authorizeRoles("hospitalAdmin"), addInsuranceCompany);
router.post('/addServiceToCompany/:companyId', authorizeRoles("hospitalAdmin"), addServiceToCompany);

// Get all insurance companies
router.get('/getInsuranceCompanies', authorizeRoles("hospitalAdmin", "doctor"), getInsuranceCompanies);

// Get details of a specific insurance company by ID
router.get('/getInsuranceCompanyDetails/:id', authorizeRoles("hospitalAdmin", "doctor"), getInsuranceCompanyDetails);

export default router;
