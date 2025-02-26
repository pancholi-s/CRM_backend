import Doctor from '../models/doctorModel.js';
import Department from '../models/departmentModel.js';

export const getDoctorsByHospital = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    const doctors = await Doctor.find({ hospital: hospitalId })
      .select('name email phone specialization status');

    const count = doctors.length;

    res.status(200).json({
      message: 'Doctors retrieved successfully',
      count,
      doctors,
    });
  } catch (error) {
    console.error('Error fetching doctors:', error);
    res.status(500).json({ message: 'Error fetching doctors' });
  }
};

export const getDoctorsByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    const department = await Department.findOne({ _id: departmentId, hospital: hospitalId });
    if (!department) {
      return res.status(404).json({ message: 'Department not found in this hospital.' });
    }

    const doctors = await Doctor.find({ departments: departmentId, hospital: hospitalId })
      .select('name email phone specialization status');

    res.status(200).json({
      message: `Doctors retrieved for department ${department.name}`,
      count: doctors.length,
      doctors,
    });
  } catch (error) {
    console.error('Error fetching doctors by department:', error);
    res.status(500).json({ message: 'Error fetching doctors by department' });
  }
};
