import Assignment from "../models/assignmentModel.js";
import Doctor from "../models/doctorModel.js";
import Staff from "../models/staffModel.js";
import Patient from "../models/patientModel.js";

export const createAssignment = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    const assignedBy = req.user._id;

    const roleModelMap = {
      doctor: "Doctor",
      hospitaladmin: "HospitalAdmin",
      receptionist: "Receptionist",
      staff: "Staff",
    };

    const assignedByModel =
      roleModelMap[req.user.role.toLowerCase()] || "Doctor";

    const {
      assignmentType,
      doctorIds,
      staffIds,
      patientIds,
      role,
      shift,
      duration,
    } = req.body;

    if (!assignmentType || !patientIds || !role || !shift || !duration) {
      return res.status(400).json({
        message:
          "Missing required fields: assignmentType, patientIds, role, shift, duration",
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

    let assignedPersons = [];
    let departmentId = null;

    if (assignmentType === "doctor") {
      if (!doctorIds || !Array.isArray(doctorIds)) {
        return res.status(400).json({
          message:
            "doctorIds must be provided as an array for doctor assignments",
        });
      }

      const doctors = await Doctor.find({
        _id: { $in: doctorIds },
        hospital: hospitalId,
      });

      if (doctors.length !== doctorIds.length) {
        return res.status(404).json({
          message: "One or more doctors not found in hospital",
        });
      }

      assignedPersons = doctors;
      departmentId = doctors[0].departments[0];
    }

    if (assignmentType === "staff") {
      if (!staffIds || !Array.isArray(staffIds)) {
        return res.status(400).json({
          message:
            "staffIds must be provided as an array for staff assignments",
        });
      }

      const staff = await Staff.find({
        _id: { $in: staffIds },
        hospital: hospitalId,
      });

      if (staff.length !== staffIds.length) {
        return res.status(404).json({
          message: "One or more staff members not found in hospital",
        });
      }

      assignedPersons = staff;
      departmentId = staff[0].department;
    }

    const patients = await Patient.find({
      _id: { $in: patientIds },
      hospital: hospitalId,
    });

    if (patients.length !== patientIds.length) {
      return res.status(404).json({
        message: "One or more patients not found in hospital",
      });
    }

    const assignmentData = {
      patients: patientIds,
      hospital: hospitalId,
      department: departmentId,
      assignmentType,
      role,
      shift,
      duration,
      assignedBy,
      assignedByModel,
      status: "Active",
    };

    if (assignmentType === "doctor") {
      assignmentData.doctors = doctorIds;
    } else {
      assignmentData.staff = staffIds;
    }

    const assignment = new Assignment(assignmentData);
    await assignment.save();

    if (assignmentType === "doctor") {
      await Doctor.updateMany(
        { _id: { $in: doctorIds } },
        { $addToSet: { patients: { $each: patientIds } } }
      );

      await Patient.updateMany(
        { _id: { $in: patientIds } },
        { $addToSet: { doctors: { $each: doctorIds } } }
      );
    } else {
      await Staff.updateMany(
        { _id: { $in: staffIds } },
        { $addToSet: { patients: { $each: patientIds } } }
      );

      await Patient.updateMany(
        { _id: { $in: patientIds } },
        { $addToSet: { staff: { $each: staffIds } } }
      );
    }

    const populatedAssignment = await Assignment.findById(assignment._id)
      .populate("doctors", "name specialization")
      .populate("staff", "name position")
      .populate("patients", "name age gender")
      .populate("department", "name")
      .populate({
        path: "assignedBy",
        select: "name email role",
        model: assignedByModel,
      });

    res.status(201).json({
      message: `${assignmentType} assignment created successfully`,
      assignment: populatedAssignment,
    });
  } catch (error) {
    console.error("Error creating assignment:", error);
    res.status(500).json({
      message: "Failed to create assignment",
      error: error.message,
    });
  }
};

export const getAssignments = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    const {
      assignmentType,
      doctorId,
      staffId,
      patientId,
      status = "Active",
      departmentId,
      shift,
      page = 1,
      limit = 10,
    } = req.query;

    const filter = { hospital: hospitalId };

    if (assignmentType) filter.assignmentType = assignmentType;
    if (doctorId) filter.doctors = doctorId;
    if (staffId) filter.staff = staffId;
    if (patientId) filter.patients = patientId;
    if (status) filter.status = status;
    if (departmentId) filter.department = departmentId;
    if (shift) filter.shift = shift;

    const skip = (page - 1) * limit;

    const assignments = await Assignment.find(filter)
      .populate("doctors", "name specialization status")
      .populate("staff", "name position status")
      .populate("patients", "name age gender")
      .populate("department", "name")
      .populate({
        path: "assignedBy",
        select: "name role",
        model: "Doctor",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const totalAssignments = await Assignment.countDocuments(filter);

    res.status(200).json({
      message: "Assignments retrieved successfully",
      count: assignments.length,
      totalAssignments,
      totalPages: Math.ceil(totalAssignments / limit),
      currentPage: parseInt(page),
      assignments,
    });
  } catch (error) {
    console.error("Error fetching assignments:", error);
    res.status(500).json({ message: "Failed to fetch assignments" });
  }
};

export const getDoctorAssignments = async (req, res) => {
  try {
    const { doctorId } = req.params;
    const hospitalId = req.session.hospitalId;

    const assignments = await Assignment.find({
      doctors: doctorId,
      hospital: hospitalId,
      status: "Active",
    })
      .populate("patients", "name age gender")
      .populate("department", "name")
      .populate({
        path: "assignedBy",
        select: "name role",
        model: "Doctor",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Doctor assignments retrieved successfully",
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("Error fetching doctor assignments:", error);
    res.status(500).json({ message: "Failed to fetch doctor assignments" });
  }
};

export const getStaffAssignments = async (req, res) => {
  try {
    const { staffId } = req.params;
    const hospitalId = req.session.hospitalId;

    const assignments = await Assignment.find({
      staff: staffId,
      hospital: hospitalId,
      status: "Active",
    })
      .populate("patients", "name age gender")
      .populate("department", "name")
      .populate({
        path: "assignedBy",
        select: "name role",
        model: "Staff",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Staff assignments retrieved successfully",
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("Error fetching staff assignments:", error);
    res.status(500).json({ message: "Failed to fetch staff assignments" });
  }
};

export const getPatientAssignments = async (req, res) => {
  try {
    const { patientId } = req.params;
    const hospitalId = req.session.hospitalId;

    const assignments = await Assignment.find({
      patients: patientId,
      hospital: hospitalId,
      status: "Active",
    })
      .populate("doctors", "name specialization")
      .populate("staff", "name position")
      .populate("department", "name")
      .populate({
        path: "assignedBy",
        select: "name role",
        model: "Doctor",
      })
      .sort({ createdAt: -1 });

    res.status(200).json({
      message: "Patient assignments retrieved successfully",
      count: assignments.length,
      assignments,
    });
  } catch (error) {
    console.error("Error fetching patient assignments:", error);
    res.status(500).json({ message: "Failed to fetch patient assignments" });
  }
};

export const updateAssignmentStatus = async (req, res) => {
  try {
    const { assignmentId } = req.params;
    const { status } = req.body;
    const hospitalId = req.session.hospitalId;

    if (!["Active", "Completed", "Cancelled"].includes(status)) {
      return res.status(400).json({ message: "Invalid status" });
    }

    const assignment = await Assignment.findOneAndUpdate(
      { _id: assignmentId, hospital: hospitalId },
      { status },
      { new: true }
    )
      .populate("doctors", "name")
      .populate("staff", "name position")
      .populate("patients", "name")
      .populate({
        path: "assignedBy",
        select: "name role",
        model: "Doctor",
      });

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }

    res.status(200).json({
      message: "Assignment status updated successfully",
      assignment,
    });
  } catch (error) {
    console.error("Error updating assignment:", error);
    res.status(500).json({ message: "Failed to update assignment" });
  }
};
