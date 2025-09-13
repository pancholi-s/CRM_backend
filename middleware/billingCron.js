import cron from "node-cron";
import Bill from "../models/billModel.js";
import Bed from "../models/bedModel.js";
import Room from "../models/roomModel.js";
import InsuranceCompany from "../models/insuranceCompanyModel.js";
import Service from "../models/serviceModel.js";
import AdmissionRequest from "../models/admissionReqModel.js";

// Run daily at 01:59 AM
cron.schedule("36 00 * * *", async () => {
  console.log("⏱️ Live Billing Cron (Daily): Running...");

  try {
    // ✅ Populate patient so we can access insurance details
    const liveBills = await Bill.find({ isLive: true }).populate('patient');

    if (!liveBills.length) {
      console.log("ℹ️ No active live bills found.");
      return;
    }

    for (const bill of liveBills) {
      // Find occupied bed
      const bed = await Bed.findOne({ assignedPatient: bill.patient._id, status: "Occupied" });
      if (!bed) {
        console.log(`⚠️ Case ${bill.caseId}: No occupied bed found, skipping...`);
        continue;
      }

      const room = await Room.findById(bed.room);
      if (!room) {
        console.log(`⚠️ Case ${bill.caseId}: Room not found, skipping...`);
        continue;
      }
      const roomType = room.roomType;

      // Fetch admission request for insurance approval
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

      // --- Calculate start/end dates ---
      let startDate;
      if (bill.lastBilledAt) {
        startDate = new Date(bill.lastBilledAt);
        startDate.setHours(0,0,0,0);
        startDate.setDate(startDate.getDate() + 1); // start next day
      } else if (admissionRequest?.admissionDetails?.date) {
        startDate = new Date(admissionRequest.admissionDetails.date);
        startDate.setHours(0,0,0,0);
      } else {
        startDate = new Date();
        startDate.setHours(0,0,0,0);
      }

      const today = new Date();
      today.setHours(0,0,0,0);
      const endDate = new Date(today);
      endDate.setDate(endDate.getDate() - 1); // up to yesterday

      if (startDate > endDate) {
        console.log(`➡️ Case ${bill.caseId}: No new days to bill.`);
        continue;
      }

      let totalAdded = 0;

      // --- Loop per day ---
      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const billedDateStr = d.toISOString().split("T")[0];

        // Skip duplicates
        const existingEntry = bill.services.find(s => s.details?.billedDate === billedDateStr);
        if (existingEntry) continue;

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
          console.log(`⚠️ Case ${bill.caseId}: No valid room category for ${roomType}, skipping day ${billedDateStr}`);
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
      bill.lastBilledAt = new Date();
      await bill.save();

      console.log(
        `✅ Case ${bill.caseId}: Added daily room charges from ${startDate.toISOString().split("T")[0]} to ${endDate.toISOString().split("T")[0]}.
           Room Type: ${roomType}
           Total added: ${totalAdded}
           New Total: ${bill.totalAmount}`
      );
    }

    console.log("✅ Live Billing Cron (Daily): Cycle complete.\n");
  } catch (err) {
    console.error("❌ Error in daily billing cron:", err);
  }
});
