import Appointment from "../models/appointmentModel.js";
import cron from "node-cron";
import mongoose from "mongoose";

/**
 * Helper: Get IST start/end of today in UTC terms
 */
function getISTDayBounds() {
  const tz = "Asia/Kolkata";

  // Current IST time as string
  const istString = new Date().toLocaleString("en-US", { timeZone: tz });
  const istNow = new Date(istString);

  // Start of IST day
  const istStart = new Date(istNow);
  istStart.setHours(0, 0, 0, 0);

  // End of IST day
  const istEnd = new Date(istNow);
  istEnd.setHours(23, 59, 59, 999);

  return { istNow, istStart, istEnd };
}

/**
 * Middleware: Update "Scheduled" → "Waiting" for today's IST appointments
 */

export const updateStatusesMiddleware = async (req, res, next) => {
  try {
    const { istStart, istEnd } = getISTDayBounds();

    await Appointment.updateMany(
      {
        status: "Scheduled",
        tokenDate: { $gte: istStart, $lte: istEnd },
      },
      { $set: { status: "Waiting" } }
    );

    next();
  } catch (error) {
    console.error("Error updating statuses:", error);
    res.status(500).json({ message: "Error updating appointment statuses." });
  }
};

/**
 * Cron: Every minute, move the next Waiting → Ongoing
 */
cron.schedule("* * * * *", async () => {
  try {
    const { istNow, istStart } = getISTDayBounds();

    // Pick the lowest tokenNumber among waiting patients
    const appointment = await Appointment.findOne({
      status: "Waiting",
      tokenDate: { $gte: istStart, $lte: istNow },
    }).sort({ tokenNumber: 1 });

    if (appointment) {
      appointment.status = "Ongoing";
      await appointment.save();
      console.log(`✅ Appointment ${appointment._id} set to Ongoing (IST).`);
    }
  } catch (err) {
    console.error("❌ Cron job error:", err.message);
  }
});
