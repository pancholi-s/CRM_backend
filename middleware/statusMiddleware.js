import Appointment from "../models/appointmentModel.js";
import cron from "node-cron";
import mongoose from "mongoose";

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
  
cron.schedule("* * * * *", async () => {
  try {
    const now = new Date();

    // Get today's start and end times
    const startOfDay = new Date(now);
    startOfDay.setHours(0, 0, 0, 0);

    const endOfDay = new Date(now);
    endOfDay.setHours(23, 59, 59, 999);

    // Find token number 1 scheduled for today, with tokenDate <= now
    const appointment = await Appointment.findOne({
      tokenNumber: 1,
      status: "Waiting",
      tokenDate: { $gte: startOfDay, $lte: now },
    });

    if (appointment) {
      appointment.status = "Ongoing";
      await appointment.save();
      console.log(`✅ Appointment ${appointment._id} set to Ongoing.`);
    }
  } catch (err) {
    console.error("❌ Cron job error:", err.message);
  }
});

