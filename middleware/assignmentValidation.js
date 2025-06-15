import Doctor from "../models/doctorModel.js";
import Staff from "../models/staffModel.js";
import Patient from "../models/patientModel.js";

export const validateAssignmentData = (req, res, next) => {
  const { assignmentType, patientIds, role, shift, duration } = req.body;

  if (!assignmentType || !patientIds || !role || !shift || !duration) {
    return res.status(400).json({
      message: "Missing required fields: assignmentType, patientIds, role, shift, duration",
    });
  }

  if (!["doctor", "staff"].includes(assignmentType)) {
    return res.status(400).json({
      message: "assignmentType must be either 'doctor' or 'staff'",
    });
  }

  if (!Array.isArray(patientIds)) {
    return res.status(400).json({
      message: "patientIds must be an array",
    });
  }

  next();
};

export const validateDoctorAssignment = async (req, res, next) => {
  const { assignmentType, doctorIds } = req.body;
  const hospitalId = req.session.hospitalId;

  if (assignmentType === "doctor") {
    if (!doctorIds || !Array.isArray(doctorIds)) {
      return res.status(400).json({
        message: "doctorIds must be provided as an array for doctor assignments",
      });
    }

    try {
      const doctors = await Doctor.find({
        _id: { $in: doctorIds },
        hospital: hospitalId,
      });

      if (doctors.length !== doctorIds.length) {
        return res.status(404).json({
          message: "One or more doctors not found in hospital",
        });
      }

      req.validatedDoctors = doctors;
    } catch (error) {
      return res.status(500).json({
        message: "Error validating doctors",
        error: error.message,
      });
    }
  }

  next();
};

export const validateStaffAssignment = async (req, res, next) => {
  const { assignmentType, staffIds } = req.body;
  const hospitalId = req.session.hospitalId;

  if (assignmentType === "staff") {
    if (!staffIds || !Array.isArray(staffIds)) {
      return res.status(400).json({
        message: "staffIds must be provided as an array for staff assignments",
      });
    }

    try {
      const staff = await Staff.find({
        _id: { $in: staffIds },
        hospital: hospitalId,
      });

      if (staff.length !== staffIds.length) {
        return res.status(404).json({
          message: "One or more staff members not found in hospital",
        });
      }

      req.validatedStaff = staff;
    } catch (error) {
      return res.status(500).json({
        message: "Error validating staff",
        error: error.message,
      });
    }
  }

  next();
};

export const validatePatientAssignment = async (req, res, next) => {
  const { patientIds } = req.body;
  const hospitalId = req.session.hospitalId;

  try {
    const patients = await Patient.find({
      _id: { $in: patientIds },
      hospital: hospitalId,
    });

    if (patients.length !== patientIds.length) {
      return res.status(404).json({
        message: "One or more patients not found in hospital",
      });
    }

    req.validatedPatients = patients;
  } catch (error) {
    return res.status(500).json({
      message: "Error validating patients",
      error: error.message,
    });
  }

  next();
};

export const validateAssignmentStatus = (req, res, next) => {
  const { status } = req.body;

  if (!["Active", "Completed", "Cancelled"].includes(status)) {
    return res.status(400).json({ message: "Invalid status" });
  }

  next();
};