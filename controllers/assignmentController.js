import Assignment from "../models/assignmentModel.js";
import Doctor from "../models/doctorModel.js";
import Staff from "../models/staffModel.js";
import Patient from "../models/patientModel.js";

export const createAssignment = async (req, res) => {
  try {
    const { assignmentType, doctorIds, staffIds, patientIds } = req.body;
    const assignmentData = req.assignmentData;

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
        model: req.assignedByModel
      });

    res.status(201).json({
      message: `${assignmentType} assignment created successfully`,
      assignment: populatedAssignment,
    });
  } catch (error) {
    console.error("Error creating assignment:", error);
    res.status(500).json({ 
      message: "Failed to create assignment", 
      error: error.message 
    });
  }
};

export const getAssignments = async (req, res) => {
  try {
    const filter = req.assignmentFilters;
    const { page, limit, skip } = req.pagination;

    const assignments = await Assignment.find(filter)
      .populate("doctors", "name specialization status")
      .populate("staff", "name position status")
      .populate("patients", "name age gender")
      .populate("department", "name")
      .populate({
        path: "assignedBy",
        select: "name role",
        model: "Doctor"
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const totalAssignments = await Assignment.countDocuments(filter);

    res.status(200).json({
      message: "Assignments retrieved successfully",
      count: assignments.length,
      totalAssignments,
      totalPages: Math.ceil(totalAssignments / limit),
      currentPage: page,
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
        model: "Doctor"
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
        model: "Staff"
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
        model: "Doctor"
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
        model: "Doctor"
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