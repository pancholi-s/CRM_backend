import Hospital from "../models/hospitalModel.js";
import Department from "../models/departmentModel.js";
import Staff from "../models/staffModel.js";
import mongoose from "mongoose";

export const addStaff = async (req, res) => {
  const {
    profile,
    staff_id,
    name,
    email,
    phone,
    department,
    designation,
    status
  } = req.body;

  const hospitalId = req.session.hospitalId;
  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access." });
  }

  const session = await Staff.startSession();
  session.startTransaction();

  try {
    const hospital = await Hospital.findById(hospitalId).session(session);
    if (!hospital) throw new Error("Hospital not found");

    const dept = await Department.findById(department).session(session);
    if (!dept || dept.hospital.toString() !== hospitalId) {
      throw new Error("Invalid department");
    }

    // 🔐 default password (staff must reset later)
    const defaultPassword = "changeme123";

    const staff = new Staff({
      profile,
      staff_id,
      name,
      email,
      password: defaultPassword,
      phone,
      department: dept._id,
      designation,
      status,
      hospital: hospital._id,
    });

    await staff.save({ session });

    await Department.findByIdAndUpdate(
      department,
      { $push: { staffs: staff._id } },
      { session }
    );

    await Hospital.findByIdAndUpdate(
      hospitalId,
      { $push: { staffs: staff._id } },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    const populatedStaff = await Staff.findById(staff._id)
      .populate("department", "name")
      .select("-password");

    res.status(201).json({
      message: "Staff added successfully",
      staff: populatedStaff,
      tempPassword: defaultPassword // ⚠️ optional – show once
    });

  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    res.status(500).json({ message: error.message });
  }
};

export const getStaff = async (req, res) => {
  const hospitalId = req.session.hospitalId;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access." });
  }

  try {
    const total = await Staff.countDocuments({ hospital: hospitalId });
    const staff = await Staff.find({ hospital: hospitalId })
      .populate("department", "name")
      .populate("hospital", "name")
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      message: "Staff retrieved successfully.",
      count: staff.length,
      totalStaff: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      staff,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching staff.", error: error.message });
  }
};

export const getStaffByDepartment = async (req, res) => {
  const hospitalId = req.session.hospitalId;
  const { departmentId } = req.params;

  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access." });
  }

  if (!mongoose.Types.ObjectId.isValid(departmentId)) {
    return res.status(400).json({ message: "Invalid department ID." });
  }

  try {
    const staff = await Staff.find({
      hospital: hospitalId,
      department: departmentId,
    })
      .populate("department", "name")
      .populate("hospital", "name");

    res.status(200).json({
      message: "Staff filtered by department retrieved successfully.",
      count: staff.length,
      staff,
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching staff.", error: error.message });
  }
};
