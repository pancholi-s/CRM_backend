import Appointment from '../models/appointmentModel.js';
import Department from '../models/departmentModel.js';

// Fetch appointments based on dynamic status or get all if status is 'Scheduled'
export const getAppointmentsByStatus = async (req, res) => {
  const { status } = req.query;

  try {
    let appointments;

    // If status is 'Scheduled', fetch all appointments regardless of status
    if (status === 'Scheduled') {
      appointments = await Appointment.find()
        .populate('patient', 'name email')
        .populate('doctor', 'name email');
    } else if (status) {
      // Otherwise, filter by the provided status
      appointments = await Appointment.find({ status })
        .populate('patient', 'name email')
        .populate('doctor', 'name email');
    } else {
      return res.status(400).json({ message: 'Status query parameter is required.' });
    }

    // Count of retrieved appointments
    const count = appointments.length;

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

// Fetch appointments filtered by departmentId and status
export const getFilteredAppointments = async (req, res) => {
  const { departmentId, status } = req.query;

  // Validate that departmentId and status are provided
  if (!departmentId || !status) {
    return res.status(400).json({ message: 'Both departmentId and status are required.' });
  }

  try {
    // Ensure the department exists
    const department = await Department.findById(departmentId);
    if (!department) {
      return res.status(404).json({ message: 'Department not found.' });
    }

    // Check that status is a valid status in the Appointment schema
    const validStatuses = Appointment.schema.path('status').enumValues;
    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid appointment status.' });
    }

    // Find appointments with the specified department and status
    const appointments = await Appointment.find({
      department: departmentId,
      status: status,
    })
      .populate('patient', 'name email')
      .populate('doctor', 'name email');

    // Count of filtered appointments
    const count = appointments.length;

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
