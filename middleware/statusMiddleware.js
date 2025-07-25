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

    const startOfDay = new Date(now);
    startOfDay.setUTCHours(0, 0, 0, 0);

    // Use UTC comparison for `tokenDate`
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


