import Appointment from '../models/appointmentModel.js';
import { getDepartments } from '../controllers/departmentController.js';

// Fetch all appointments and include total count of 'Scheduled' appointments
export const getScheduledAppointments = async (req, res) => {
    try {
      // Get all appointments
      const allAppointments = await Appointment.find()
        .populate('patient', 'name email')
        .populate('doctor', 'name email');
  
      // Filter and count scheduled appointments
      //const scheduledCount = allAppointments.filter(appointment => appointment.status === 'Scheduled').length;
  
      res.status(200).json({
        message: 'All appointments retrieved successfully',
        scheduledCount: allAppointments.length,
        appointments: allAppointments,
      });
    } catch (error) {
      console.error('Error fetching appointments:', error);
      res.status(500).json({ message: 'Error fetching appointments' });
    }
  };
  

// Fetch appointments with status 'Ongoing' and get the count
export const getOngoingAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ status: 'Ongoing' })
      .populate('patient', 'name email')
      .populate('doctor', 'name email');
    const count = appointments.length;

    res.status(200).json({
      message: 'Ongoing appointments retrieved successfully',
      count,
      appointments,
    });
  } catch (error) {
    console.error('Error fetching ongoing appointments:', error);
    res.status(500).json({ message: 'Error fetching ongoing appointments' });
  }
};

// Fetch appointments with status 'Waiting' and get the count
export const getWaitingAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ status: 'Waiting' })
      .populate('patient', 'name email')
      .populate('doctor', 'name email');
    const count = appointments.length;

    res.status(200).json({
      message: 'Waiting appointments retrieved successfully',
      count,
      appointments,
    });
  } catch (error) {
    console.error('Error fetching waiting appointments:', error);
    res.status(500).json({ message: 'Error fetching waiting appointments' });
  }
};

// Fetch appointments with status 'Completed' and get the count
export const getCompletedAppointments = async (req, res) => {
  try {
    const appointments = await Appointment.find({ status: 'Completed' })
      .populate('patient', 'name email')
      .populate('doctor', 'name email');
    const count = appointments.length;

    res.status(200).json({
      message: 'Completed appointments retrieved successfully',
      count,
      appointments,
    });
  } catch (error) {
    console.error('Error fetching completed appointments:', error);
    res.status(500).json({ message: 'Error fetching completed appointments' });
  }
};
