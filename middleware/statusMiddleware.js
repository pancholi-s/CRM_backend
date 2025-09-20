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



// cron.schedule("* * * * *", async () => {
//   try {
//     const { istNow, istStart, istEnd } = getISTDayBounds();

//     // --- Check if anyone is already Ongoing ---
//     const ongoing = await Appointment.findOne({
//       status: "Ongoing",
//       tokenDate: { $gte: istStart, $lte: istEnd },
//     });
//     if (ongoing) {
//       console.log(`⏳ Token ${ongoing.tokenNumber} is already Ongoing. No promotion this tick.`);
//       return;
//     }

//     // --- Handle Token 1 early start ---
//     const token1 = await Appointment.findOne({
//       status: "Waiting",
//       tokenNumber: 1,
//       tokenDate: {
//         $gte: new Date(istNow.getTime() + 5 * 60000),
//         $lte: new Date(istNow.getTime() + 10 * 60000),
//       },
//     });

//     if (token1) {
//       const anotherOngoing = await Appointment.findOne({
//         status: "Ongoing",
//         tokenDate: { $gte: istStart, $lte: istEnd },
//       });

//       if (!anotherOngoing) {
//         token1.status = "Ongoing";
//         await token1.save();
//         console.log(`✅ Token 1 set to Ongoing (early start).`);
//       } else {
//         console.log(`⚠️ Cannot promote Token 1, another token ${anotherOngoing.tokenNumber} is Ongoing.`);
//       }
//       return;
//     }

//     // --- Handle next token in order ---
//     const nextToken = await Appointment.findOne({
//       status: "Waiting",
//       tokenNumber: { $gt: 1 },
//       tokenDate: { $gte: istStart, $lte: istEnd },
//     }).sort({ tokenNumber: 1 });

//     if (!nextToken) return;

//     // --- Check all previous tokens completed ---
//     const unfinishedBefore = await Appointment.findOne({
//       tokenNumber: { $lt: nextToken.tokenNumber },
//       tokenDate: { $gte: istStart, $lte: istEnd },
//       status: { $nin: ["completed", "Completed"] },
//     });

//     if (unfinishedBefore) {
//       console.log(
//         `⏳ Token ${nextToken.tokenNumber} blocked, previous token ${unfinishedBefore.tokenNumber} is not completed.`
//       );
//       return;
//     }

//     // --- Ensure no other token became Ongoing while waiting ---
//     const checkOngoing = await Appointment.findOne({
//       status: "Ongoing",
//       tokenDate: { $gte: istStart, $lte: istEnd },
//     });
//     if (checkOngoing) {
//       console.log(`⚠️ Cannot promote Token ${nextToken.tokenNumber}, token ${checkOngoing.tokenNumber} is Ongoing.`);
//       return;
//     }

//     // --- Promote to Ongoing only if scheduled time reached ---
//     if (istNow.getTime() >= nextToken.tokenDate.getTime()) {
//       nextToken.status = "Ongoing";
//       await nextToken.save();
//       console.log(`✅ Token ${nextToken.tokenNumber} set to Ongoing at scheduled time.`);
//     } else {
//       console.log(`⏳ Token ${nextToken.tokenNumber} waiting until scheduled time.`);
//     }
//   } catch (err) {
//     console.error("❌ Cron job error:", err.message);
//   }
// });

cron.schedule("* * * * *", async () => {
  try {
    const { istNow } = getISTDayBounds();

    // Find Token 1 that is still Waiting
    const token1 = await Appointment.findOne({
      tokenNumber: 1,
      status: "Waiting",
      tokenDate: { $lte: new Date(istNow.getTime() + 10 * 60000) }, // allow early start within 10 min
    });

    if (token1) {
      token1.status = "Ongoing";
      await token1.save();
      console.log(`✅ Token 1 set to Ongoing.`);
    } else {
      console.log(`⏳ Token 1 is already Ongoing or no token to promote.`);
    }
  } catch (err) {
    console.error("❌ Cron job error:", err.message);
  }
});