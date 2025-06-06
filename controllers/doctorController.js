import Doctor from "../models/doctorModel.js";
import Department from "../models/departmentModel.js";

export const getDoctorsByHospital = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    // Fetch total count of doctors
    const totalDoctors = await Doctor.countDocuments({ hospital: hospitalId });

    // Fetch doctors with pagination
    const doctors = await Doctor.find({ hospital: hospitalId })
      .select("name email phone specialization status")
      .populate("departments", "name")
      .skip(skip)
      .limit(limit);

    res.status(200).json({
      message: "Doctors retrieved successfully",
      count: doctors.length,
      totalDoctors,
      totalPages: Math.ceil(totalDoctors / limit),
      currentPage: page,
      doctors,
    });
  } catch (error) {
    console.error("Error fetching doctors:", error);
    res.status(500).json({ message: "Error fetching doctors" });
  }
};

export const getDoctorsByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const hospitalId = req.session.hospitalId;
    const { page = 1, limit = 10 } = req.query; // Default to page 1, limit 10

    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context not found in session." });
    }

    const department = await Department.findOne({ _id: departmentId, hospital: hospitalId });
    if (!department) {
      return res.status(404).json({ message: "Department not found in this hospital." });
    }

    const doctors = await Doctor.find({ departments: departmentId, hospital: hospitalId })
      .select("name email phone specialization status")
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    const totalDoctors = await Doctor.countDocuments({ departments: departmentId, hospital: hospitalId });

    res.status(200).json({
      message: `Doctors retrieved for department ${department.name}`,
      totalDoctors,
      page: parseInt(page),
      totalPages: Math.ceil(totalDoctors / limit),
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error("Error fetching doctors by department:", error);
    res.status(500).json({ message: "Error fetching doctors by department" });
  }
};
