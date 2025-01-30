import Doctor from '../models/doctorModel.js'; // Update the path as per your project structure

export const getDoctorsByHospital = async (req, res) => {
  try {
    // Retrieve hospitalId from the session
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    // Fetch doctors belonging to the hospital
    const doctors = await Doctor.find({ hospital: hospitalId })
      .select('name email phone specialization status'); // Select only the required fields

    // Count of retrieved doctors
    const count = doctors.length;

    // Send response
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
