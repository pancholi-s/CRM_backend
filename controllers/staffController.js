import Staff from "../models/staffModel.js";
import Department from "../models/departmentModel.js";
import Hospital from "../models/hospitalModel.js";

// Add Staff
export const addStaff = async (req, res) => {
  const { profile, staff_id, name, phone, department, designation, status } =
    req.body;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access." });
  }

  const session = await Staff.startSession(); // Start a transaction
  session.startTransaction();

  try {
    // Validate hospital
    const hospital = await Hospital.findById(hospitalId).session(session);
    if (!hospital) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Hospital not found." });
    }

    // Validate department
    const dept = await Department.findById(department).session(session);
    if (!dept || dept.hospital.toString() !== hospitalId) {
      await session.abortTransaction();
      session.endSession();
      return res
        .status(404)
        .json({ message: "Department not found in the specified hospital." });
    }

    // Create new staff
    const staff = new Staff({
      profile,
      staff_id,
      name,
      phone,
      department: dept._id,
      designation,
      status,
      hospital: hospital._id,
    });

    await staff.save({ session });

    // Update department with staff reference
    await Department.findByIdAndUpdate(
      department,
      { $push: { staffs: staff._id } },
      { session }
    );

    // Update hospital with staff reference
    await Hospital.findByIdAndUpdate(
      hospitalId,
      { $push: { staffs: staff._id } },
      { session }
    );

    // Commit transaction
    await session.commitTransaction();
    session.endSession();

    res.status(201).json({ message: "Staff added successfully.", staff });
  } catch (error) {
    await session.abortTransaction(); // Rollback transaction on error
    session.endSession();
    res
      .status(500)
      .json({ message: "Error adding staff.", error: error.message });
  }
};

// Get Staff
export const getStaff = async (req, res) => {
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: "Unauthorized access." });
  }

  try {
    const staff = await Staff.find({ hospital: hospitalId })
      .populate("department", "name")
      .populate("hospital", "name");
    res.status(200).json(staff);
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching staff.", error: error.message });
  }
};
