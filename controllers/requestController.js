import Request from "../models/requestModel.js";

export const createRequest = async (req, res) => {
  try {
    const {
      requestType,
      title,
      description,
      priority,
      items,
      expectedDate,
      notes,
      estimatedCost,
    } = req.body;

    const doctorId = req.user._id;
    const hospitalId = req.session.hospitalId || req.user.hospital;
    const departmentId = req.user.departments?.[0] || req.body.departmentId;

    if (!requestType || !title || !description) {
      return res.status(400).json({
        message: "Request type, title, and description are required.",
      });
    }

    if (requestType === "Medicine" && (!items || items.length === 0)) {
      return res.status(400).json({
        message: "Items are required for medicine requests.",
      });
    }

    const newRequest = new Request({
      requestBy: doctorId,
      requestType,
      title,
      description,
      priority: priority || "Medium",
      department: departmentId,
      hospital: hospitalId,
      items: items || [],
      expectedDate: expectedDate ? new Date(expectedDate) : null,
      notes,
      estimatedCost,
      timeline: [
        {
          action: "Request Created",
          message: `Request for ${requestType} has been created`,
          actionBy: doctorId,
          actionByRole: "doctor",
          actionByModel: "Doctor",
        },
      ],
    });

    await newRequest.save();

    const populatedRequest = await Request.findById(newRequest._id)
      .populate("requestBy", "name specialization")
      .populate("department", "name")
      .populate("hospital", "name")
      .populate("timeline.actionBy", "name role");

    res.status(201).json({
      message: "Request created successfully.",
      data: populatedRequest,
    });
  } catch (error) {
    console.error("Error creating request:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

export const getRequests = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user._id;
    const hospitalId = req.session?.hospitalId || req.user.hospital;

    const {
      status,
      requestType,
      priority,
      page = 1,
      limit = 10,
      sortBy = "createdAt",
      sortOrder = "desc",
    } = req.query;

    let filter = {};

    switch (userRole) {
      case "doctor":
        filter.requestBy = userId;
        break;
      case "hospitalAdmin":
      case "receptionist":
      case "staff":
        filter.hospital = hospitalId;
        break;
      default:
        return res.status(403).json({ message: "Unauthorized access" });
    }

    if (status) {
      if (status === "active") {
        filter.status = { $in: ["Active", "In Progress"] };
      } else if (status === "inactive") {
        filter.status = { $in: ["Completed", "Rejected", "Cancelled"] };
      } else {
        filter.status = status;
      }
    }

    if (requestType) filter.requestType = requestType;
    if (priority) filter.priority = priority;

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === "desc" ? -1 : 1;

    const requests = await Request.find(filter)
      .populate("requestBy", "name specialization")
      .populate("department", "name")
      .populate("hospital", "name")
      .populate("timeline.actionBy", "name role")
      .sort({ [sortBy]: sortDirection })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Request.countDocuments(filter);

    res.status(200).json({
      data: requests,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(total / limit),
        totalRecords: total,
        limit: parseInt(limit),
      },
    });
  } catch (error) {
    console.error("Error fetching requests:", error);
    res.status(500).json({ message: "Failed to fetch requests" });
  }
};

export const getRequestById = async (req, res) => {
  try {
    const { requestId } = req.params;
    const userRole = req.user.role;
    const userId = req.user._id;
    const hospitalId = req.session?.hospitalId || req.user.hospital;

    const request = await Request.findById(requestId)
      .populate("requestBy", "name specialization email phone")
      .populate("department", "name")
      .populate("hospital", "name")
      .populate("timeline.actionBy", "name role")
      .populate("attachments.uploadedBy", "name");

    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (
      userRole === "doctor" &&
      request.requestBy._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    if (
      ["hospitalAdmin", "receptionist", "staff"].includes(userRole) &&
      request.hospital._id.toString() !== hospitalId.toString()
    ) {
      return res.status(403).json({ message: "Access denied" });
    }

    res.status(200).json({ data: request });
  } catch (error) {
    console.error("Error fetching request:", error);
    res.status(500).json({ message: "Failed to fetch request" });
  }
};

export const updateRequestStatus = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { status, message, estimatedCost, actualCost } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!["hospitalAdmin", "receptionist", "staff"].includes(userRole)) {
      return res
        .status(403)
        .json({ message: "Not authorized to update request status" });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (estimatedCost !== undefined) request.estimatedCost = estimatedCost;
    if (actualCost !== undefined) request.actualCost = actualCost;

    const roleToModelMap = {
      hospitalAdmin: "HospitalAdmin",
      receptionist: "Receptionist",
      staff: "Staff",
      doctor: "Doctor",
    };

    const actionByModel = roleToModelMap[userRole];

    await request.updateStatus(
      status,
      message,
      userId,
      userRole,
      actionByModel
    );

    const updatedRequest = await Request.findById(requestId)
      .populate("requestBy", "name specialization")
      .populate("department", "name")
      .populate("hospital", "name")
      .populate("timeline.actionBy", "name role");

    res.status(200).json({
      message: "Request status updated successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error updating request status:", error);
    res.status(500).json({ message: "Failed to update request status" });
  }
};

export const addRequestComment = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const roleToModelMap = {
      hospitalAdmin: "HospitalAdmin",
      receptionist: "Receptionist",
      staff: "Staff",
      doctor: "Doctor",
    };

    const actionByModel = roleToModelMap[userRole];

    await request.addTimelineEntry(
      "Comment Added",
      message,
      userId,
      userRole,
      actionByModel
    );

    const updatedRequest = await Request.findById(requestId).populate(
      "timeline.actionBy",
      "name role"
    );

    res.status(200).json({
      message: "Comment added successfully",
      data: updatedRequest.timeline,
    });
  } catch (error) {
    console.error("Error adding comment:", error);
    res.status(500).json({ message: "Failed to add comment" });
  }
};

export const cancelRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { reason } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (
      userRole === "doctor" &&
      request.requestBy.toString() !== userId.toString()
    ) {
      return res
        .status(403)
        .json({ message: "You can only cancel your own requests" });
    }

    if (request.status === "Completed") {
      return res
        .status(400)
        .json({ message: "Cannot cancel completed request" });
    }

    const roleToModelMap = {
      hospitalAdmin: "HospitalAdmin",
      receptionist: "Receptionist",
      staff: "Staff",
      doctor: "Doctor",
    };

    const actionByModel = roleToModelMap[userRole];
    const cancelMessage = reason || "Request cancelled by user";

    await request.updateStatus(
      "Cancelled",
      cancelMessage,
      userId,
      userRole,
      actionByModel
    );

    res.status(200).json({
      message: "Request cancelled successfully",
      data: request,
    });
  } catch (error) {
    console.error("Error cancelling request:", error);
    res.status(500).json({ message: "Failed to cancel request" });
  }
};

export const getRequestStats = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user._id;
    const hospitalId = req.session?.hospitalId || req.user.hospital;

    let matchFilter = {};

    if (userRole === "doctor") {
      matchFilter.requestBy = userId;
    } else if (["hospitalAdmin", "receptionist", "staff"].includes(userRole)) {
      matchFilter.hospital = hospitalId;
    }

    const stats = await Request.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: null,
          totalRequests: { $sum: 1 },
          activeRequests: {
            $sum: {
              $cond: [{ $in: ["$status", ["Active", "In Progress"]] }, 1, 0],
            },
          },
          completedRequests: {
            $sum: {
              $cond: [{ $eq: ["$status", "Completed"] }, 1, 0],
            },
          },
          pendingRequests: {
            $sum: {
              $cond: [{ $eq: ["$status", "Active"] }, 1, 0],
            },
          },
          rejectedRequests: {
            $sum: {
              $cond: [{ $eq: ["$status", "Rejected"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const requestsByType = await Request.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$requestType",
          count: { $sum: 1 },
        },
      },
    ]);

    const requestsByPriority = await Request.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$priority",
          count: { $sum: 1 },
        },
      },
    ]);

    res.status(200).json({
      data: {
        overview: stats[0] || {
          totalRequests: 0,
          activeRequests: 0,
          completedRequests: 0,
          pendingRequests: 0,
          rejectedRequests: 0,
        },
        byType: requestsByType,
        byPriority: requestsByPriority,
      },
    });
  } catch (error) {
    console.error("Error fetching request stats:", error);
    res.status(500).json({ message: "Failed to fetch request statistics" });
  }
};
