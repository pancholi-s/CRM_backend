import Request from "../models/requestModel.js";

export const createRequest = async (req, res) => {
  try {
    const { order, quantity, timeline, purpose, description } = req.body;

    const doctorId = req.user._id;
    const doctorName = req.user.name;
    const hospitalId = req.session.hospitalId || req.user.hospital;

    if (!order || !quantity || !timeline || !purpose) {
      return res.status(400).json({
        message:
          "All fields are required (order, quantity, timeline, purpose).",
      });
    }

    const newRequest = new Request({
      requestBy: doctorId,
      order,
      description: description || "",
      quantity,
      timeline,
      purpose,
      hospital: hospitalId,
      status: "Pending",
      messages: [
        {
          message: `Request created: ${order}`,
          messageBy: doctorId,
          messageByRole: "doctor",
          messageByModel: "Doctor",
          messageByName: doctorName,
        },
      ],
    });

    await newRequest.save();

    const populatedRequest = await Request.findById(newRequest._id)
      .populate("requestBy", "name specialization")
      .populate("hospital", "name");

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
      status = "all",
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

    if (status !== "all") {
      switch (status) {
        case "pending":
          filter.status = "Pending";
          break;
        case "active":
          filter.status = "Active";
          break;
        case "completed":
          filter.status = "Completed";
          break;
        case "inactive":
          if (userRole === "doctor") {
            filter.status = "Completed";
          }
          break;
      }
    }

    const skip = (page - 1) * limit;
    const sortDirection = sortOrder === "desc" ? -1 : 1;

    const requests = await Request.find(filter)
      .populate("requestBy", "name specialization")
      .populate("hospital", "name")
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
      .populate("requestBy", "name specialization")
      .populate("hospital", "name");

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

export const addRequestMessage = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const userName = req.user.name;

    if (!message) {
      return res.status(400).json({ message: "Message is required" });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    const roleToModelMap = {
      hospitalAdmin: "HospitalAdmin",
      doctor: "Doctor",
      receptionist: "HospitalAdmin",
      staff: "HospitalAdmin",
    };

    const actionByModel = roleToModelMap[userRole] || "Doctor";

    await request.addMessage(
      message,
      userId,
      userRole,
      actionByModel,
      userName
    );

    const updatedRequest = await Request.findById(requestId)
      .populate("requestBy", "name specialization")
      .populate("hospital", "name");

    res.status(200).json({
      message: "Message added successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error adding message:", error);
    res.status(500).json({ message: "Failed to add message" });
  }
};

export const acceptRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const userName = req.user.name;

    if (!["hospitalAdmin", "receptionist", "staff"].includes(userRole)) {
      return res
        .status(403)
        .json({ message: "Not authorized to accept requests" });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "Pending") {
      return res.status(400).json({ message: "Request is not pending" });
    }

    const roleToModelMap = {
      hospitalAdmin: "HospitalAdmin",
      receptionist: "HospitalAdmin",
      staff: "HospitalAdmin",
    };

    const actionByModel = roleToModelMap[userRole];

    await request.acceptRequest(
      message || "Request accepted and moved to ongoing",
      userId,
      userRole,
      actionByModel,
      userName
    );

    const updatedRequest = await Request.findById(requestId)
      .populate("requestBy", "name specialization")
      .populate("hospital", "name");

    res.status(200).json({
      message: "Request accepted successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error accepting request:", error);
    res.status(500).json({ message: "Failed to accept request" });
  }
};

export const completeRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const userName = req.user.name;

    if (!["hospitalAdmin", "receptionist", "staff"].includes(userRole)) {
      return res
        .status(403)
        .json({ message: "Not authorized to complete requests" });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "Active") {
      return res.status(400).json({ message: "Request is not active" });
    }

    const roleToModelMap = {
      hospitalAdmin: "HospitalAdmin",
      receptionist: "HospitalAdmin",
      staff: "HospitalAdmin",
    };

    const actionByModel = roleToModelMap[userRole];

    await request.completeRequest(
      message || "Request completed successfully",
      userId,
      userRole,
      actionByModel,
      userName
    );

    const updatedRequest = await Request.findById(requestId)
      .populate("requestBy", "name specialization")
      .populate("hospital", "name");

    res.status(200).json({
      message: "Request completed successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error completing request:", error);
    res.status(500).json({ message: "Failed to complete request" });
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
          pendingRequests: {
            $sum: {
              $cond: [{ $eq: ["$status", "Pending"] }, 1, 0],
            },
          },
          activeRequests: {
            $sum: {
              $cond: [{ $eq: ["$status", "Active"] }, 1, 0],
            },
          },
          completedRequests: {
            $sum: {
              $cond: [{ $eq: ["$status", "Completed"] }, 1, 0],
            },
          },
        },
      },
    ]);

    const result = stats[0] || {
      totalRequests: 0,
      pendingRequests: 0,
      activeRequests: 0,
      completedRequests: 0,
    };

    res.status(200).json({
      data: {
        overview: result,
      },
    });
  } catch (error) {
    console.error("Error fetching request stats:", error);
    res.status(500).json({ message: "Failed to fetch request statistics" });
  }
};

export const rejectRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { message } = req.body;
    const userId = req.user._id;
    const userRole = req.user.role;
    const userName = req.user.name;

    if (!["hospitalAdmin", "receptionist", "staff"].includes(userRole)) {
      return res.status(403).json({ message: "Not authorized to reject requests" });
    }

    const request = await Request.findById(requestId);
    if (!request) {
      return res.status(404).json({ message: "Request not found" });
    }

    if (request.status !== "Pending") {
      return res.status(400).json({ message: "Only pending requests can be rejected" });
    }

    const roleToModelMap = {
      hospitalAdmin: "HospitalAdmin",
      receptionist: "HospitalAdmin",
      staff: "HospitalAdmin",
    };
    const actionByModel = roleToModelMap[userRole];

    await request.rejectRequest(
      message || "Request rejected",
      userId,
      userRole,
      actionByModel,
      userName
    );

    const updatedRequest = await Request.findById(requestId)
      .populate("requestBy", "name specialization")
      .populate("hospital", "name");

    res.status(200).json({
      message: "Request rejected successfully",
      data: updatedRequest,
    });
  } catch (error) {
    console.error("Error rejecting request:", error);
    res.status(500).json({ message: "Failed to reject request" });
  }
};
