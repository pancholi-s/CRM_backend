import cron from "node-cron";
import moment from "moment-timezone";
import Bill from "../models/billModel.js";
import Bed from "../models/bedModel.js";
import Room from "../models/roomModel.js";
import InsuranceCompany from "../models/insuranceCompanyModel.js";
import Service from "../models/serviceModel.js";
import AdmissionRequest from "../models/admissionReqModel.js";

const tz = "Asia/Kolkata"; // IST

// Run daily at 12:00 AM IST (18:30 UTC)
cron.schedule("30 18 * * *", async () => {
  console.log("⏱️ Live Billing Cron (IST Midnight) Running...");

  try {
    const liveBills = await Bill.find({ isLive: true }).populate("patient");
    if (!liveBills.length) return console.log("ℹ️ No active live bills found.");

    for (const bill of liveBills) {
      // Find occupied bed
      const bed = await Bed.findOne({ assignedPatient: bill.patient._id, status: "Occupied" });
      if (!bed) {
        console.log(`⚠️ Case ${bill.caseId}: No occupied bed found.`);
        continue;
      }

      const room = await Room.findById(bed.room);
      if (!room) {
        console.log(`⚠️ Case ${bill.caseId}: Room not found, skipping...`);
        continue;
      }

      const roomType = room.roomType;

      const admissionRequest = await AdmissionRequest.findOne({ caseId: bill.caseId });
      const insuranceApproved = admissionRequest?.admissionDetails?.insurance?.insuranceApproved;

      // Fetch insurance company if patient has approved insurance
      let insuranceCompany = null;
      if (bill.patient.hasInsurance && insuranceApproved === "approved" && bill.patient.insuranceDetails?.insuranceCompany) {
        insuranceCompany = await InsuranceCompany.findOne({ name: bill.patient.insuranceDetails.insuranceCompany });
        if (!insuranceCompany) {
          console.log(`⚠️ Case ${bill.caseId}: Insurance company not found, fallback to hospital rates.`);
          insuranceCompany = null;
        }
      }

      // --- IST-aware start and end dates ---
      let startDateIST;
      if (bill.lastBilledAt) {
        startDateIST = moment(bill.lastBilledAt).tz(tz).startOf("day").add(1, "day"); // next IST day
      } else if (admissionRequest?.admissionDetails?.date) {
        startDateIST = moment(admissionRequest.admissionDetails.date).tz(tz).startOf("day");
      } else {
        startDateIST = moment().tz(tz).startOf("day");
      }

      const endDateIST = moment().tz(tz).startOf("day"); // today IST

      if (startDateIST.isAfter(endDateIST)) {
        console.log(`➡️ Case ${bill.caseId}: No new days to bill.`);
        continue;
      }

      let totalAdded = 0;

      // --- Loop over each day to bill ---
      for (let d = startDateIST.clone(); d.isSameOrBefore(endDateIST); d.add(1, "day")) {
        const billedDateStr = d.format("YYYY-MM-DD");

        // Skip duplicates
        if (bill.services.find((s) => s.details?.billedDate === billedDateStr)) continue;

        // --- Fetch rate using insurance logic ---
        let roomService, roomCategory, hospitalService;

        if (insuranceCompany) {
          roomService = insuranceCompany.services.find(s => s.serviceName === "Room Type Service");
          roomCategory = roomService?.categories.find(c => c.subCategoryName === roomType);
        }

        if (!roomCategory) {
          hospitalService = await Service.findOne({
            hospital: bed.hospital,
            "categories.subCategoryName": roomType
          });
          roomCategory = hospitalService?.categories.find(c => c.subCategoryName === roomType);
        }

        if (!roomCategory) {
          console.log(`⚠️ Case ${bill.caseId}: No valid room category for ${roomType}, skipping ${billedDateStr}`);
          continue;
        }

        const rateToApply = roomCategory?.rate || bed.charges.dailyRate;
        const roomDetails = roomCategory?.additionaldetails || {};

        // --- Push daily entry ---
        bill.services.push({
          service: roomService?._id || hospitalService?._id || null,
          category: "Room Charges daily",
          quantity: 1,
          rate: rateToApply,
          details: {
            bedNumber: bed.bedNumber,
            daysOccupied: 1,
            totalCharge: rateToApply,
            billedDate: billedDateStr,
            bedType: roomCategory?.subCategoryName || "Not Specified",
            features: bed.features || {},
            roomDetails
          }
        });

        bill.totalAmount += rateToApply;
        totalAdded += rateToApply;
      }

      bill.outstanding = bill.totalAmount - bill.paidAmount;
      bill.lastBilledAt = new Date(); // UTC timestamp
      await bill.save();

      console.log(
        `✅ Case ${bill.caseId}: Added daily room charges from ${startDateIST.format("YYYY-MM-DD")} to ${endDateIST.format("YYYY-MM-DD")}.
         Room Type: ${roomType}
         Total added: ${totalAdded}
         New Total: ${bill.totalAmount}`
      );
    }

    console.log("✅ Live Billing Cron (IST Midnight) Complete.");
  } catch (err) {
    console.error("❌ Error in Live Billing Cron:", err);
  }
});
