import express from "express";
import { upload } from "../middleware/uploadMiddleware.js";
import { uploadInsuranceCompaniesExcel } from "../controllers/insuranceCompanyController.js";
import {
  addInsuranceCompany,
  addServiceToCompany,
  getInsuranceCompanies,
  getInsuranceCompanyDetails,
  editServiceCategory,
  deleteSingleCategory,
  deleteAllCategories,
  updateAdmissionInsuranceDetails
} from "../controllers/insuranceCompanyController.js";
import { requireHospitalContext } from "../middleware/hospitalContext.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();
router.use(requireHospitalContext);

// Add a new insurance company
router.post(
  "/addInsuranceCompany",
  authorizeRoles("hospitalAdmin"),
  addInsuranceCompany
);
router.post(
  "/addServiceToCompany/:companyId",
  authorizeRoles("hospitalAdmin"),
  addServiceToCompany
);

router.post(
  "/uploadInsuranceCompanies",
  authorizeRoles("hospitalAdmin"),
  upload.single("file"),
  uploadInsuranceCompaniesExcel
);

// Get all insurance companies
router.get(
  "/getInsuranceCompanies",
  authorizeRoles("hospitalAdmin", "doctor","staff"),
  getInsuranceCompanies
);

// Get details of a specific insurance company by ID
router.get(
  "/getInsuranceCompanyDetails/:companyId",
  authorizeRoles("hospitalAdmin", "doctor",'staff'),
  getInsuranceCompanyDetails
);

// Edit a specific category within a service
router.patch('/editCategory/:companyId/:serviceId/:categoryId', authorizeRoles("hospitalAdmin"), editServiceCategory);

router.patch('/updateAdmissionInsuranceDetails/:admissionId', authorizeRoles("hospitalAdmin"), updateAdmissionInsuranceDetails);

// Delete a single category from a service
router.delete('/deleteCategory/:companyId/:serviceId/:categoryId', authorizeRoles("hospitalAdmin"), deleteSingleCategory);

// Delete all categories from a service
router.delete('/deleteAllCategories/:companyId/:serviceId', authorizeRoles("hospitalAdmin"), deleteAllCategories);

export default router;
