import Appointment from "../models/appointmentModel.js";

export const updateStatusesMiddleware = async (req, res, next) => {
    try {
      const currentDate = new Date();
      const startOfDay = new Date(currentDate.setHours(0, 0, 0, 0));
      const endOfDay = new Date(currentDate.setHours(23, 59, 59, 999));
  
      // Update statuses for today's appointments
      await Appointment.updateMany(
        { 
          status: 'Scheduled', 
          tokenDate: { $gte: startOfDay, $lte: endOfDay } 
        },
        { $set: { status: 'Waiting' } }
      );
  
      next(); // Proceed to the next middleware or route handler
    } catch (error) {
      console.error("Error updating statuses:", error);
      res.status(500).json({ message: "Error updating appointment statuses." });
    }
  };
  