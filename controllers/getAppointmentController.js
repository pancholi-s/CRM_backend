import Appointment from '../models/appointmentModel.js';
import Hospital from '../models/hospitalModel.js';
import mongoose from 'mongoose';

// Fetch appointments based on dynamic status or get all if status is 'Scheduled'

//extra 1 appointment getting fetched
//get info about patients's appointment (active/inactive filtering)

export const getAppointmentsByStatus = async (req, res) => {
  const { status } = req.query;

  try {
    // Retrieve hospitalId from the session
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    let appointments;

    // If status is 'Scheduled', fetch all appointments regardless of status
    if (status === 'Scheduled') {
      appointments = await Appointment.find({ hospital: hospitalId })
        .populate('patient', 'name email') // Populate patient details
        .populate('doctor', 'name email') // Populate doctor details
        .populate('hospital', 'name address'); // Populate hospital details if needed
    } else if (status) {
      // Otherwise, filter by the provided status and hospitalId
      appointments = await Appointment.find({ status, hospital: hospitalId })
        .populate('patient', 'name email') // Populate patient details
        .populate('doctor', 'name email') // Populate doctor details
        .populate('hospital', 'name address'); // Populate hospital details if needed
    } else {
      return res.status(400).json({ message: 'Status query parameter is required.' });
    }

    // Count of retrieved appointments
    const count = appointments.length;

    // Send response
    res.status(200).json({
      message: `${status || 'All'} appointments retrieved successfully`,
      count,
      appointments,
    });
  } catch (error) {
    console.error(`Error fetching appointments:`, error);
    res.status(500).json({ message: 'Error fetching appointments' });
  }
};


export const getFilteredAppointments = async (req, res) => {
  const { departmentId, status } = req.query;

  try {
    // Retrieve hospitalId from the session
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: 'Hospital context not found in session.' });
    }

    // Validate the status
    const validStatuses = Appointment.schema.path('status').enumValues;
    if (!status || !validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid or missing appointment status.' });
    }

    // Retrieve the hospital and populate departments
    const hospital = await Hospital.findById(hospitalId).populate('departments');
    if (!hospital) {
      return res.status(404).json({ message: 'Hospital not found.' });
    }

    // Ensure departmentId is a valid ObjectId
    const departmentObjectId = new mongoose.Types.ObjectId(departmentId);

    // Check if the department belongs to the hospital
    const isDepartmentValid = hospital.departments.some(
      (dep) => dep._id.toString() === departmentObjectId.toString()
    );
    if (!isDepartmentValid) {
      return res
        .status(404)
        .json({ message: 'Department does not belong to the specified hospital.' });
    }

    // Fetch appointments filtered by departmentId, status, and hospitalId
    const appointments = await Appointment.find({
      department: departmentObjectId,
      status: status,
      hospital: hospitalId, // Ensure appointments belong to the hospital
    })
      .populate('patient', 'name email') // Populate patient details
      .populate('doctor', 'name email') // Populate doctor details
      .populate('hospital', 'name address'); // Populate hospital details

    // Count of filtered appointments
    const count = appointments.length;

    // Respond with filtered appointments
    res.status(200).json({
      message: 'Filtered appointments retrieved successfully',
      count,
      appointments,
    });
  } catch (error) {
    console.error('Error fetching filtered appointments:', error);
    res.status(500).json({ message: 'Error fetching filtered appointments' });
  }
};
