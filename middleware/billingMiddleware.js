import Bill from '../models/billModel.js';
import InsuranceCompany from '../models/insuranceCompanyModel.js';
import Service from '../models/serviceModel.js';
import Bed from '../models/bedModel.js';
import Room from '../models/roomModel.js';
import Consultation from '../models/consultationModel.js';
import Appointment from '../models/appointmentModel.js';
import AdmissionRequest from '../models/admissionReqModel.js';
import Hospital from '../models/hospitalModel.js';
import mongoose from 'mongoose';

export const updateBillAfterAction = async (caseId, session, medicationCharge) => {
  try {
    if (!caseId) throw new Error("Case ID is required.");

    // Fetch appointment or admission request
    let appointment = await Appointment.findOne({ caseId })
      .populate('patient doctor hospital department', null, null, { strictPopulate: false })
      .session(session);

    let admissionRequest = null;
    if (!appointment) {
      admissionRequest = await AdmissionRequest.findOne({ caseId })
        .populate('patient doctor hospital department', null, null, { strictPopulate: false })
        .session(session);

      if (admissionRequest) {
        appointment = {
          patient: admissionRequest.patient,
          doctor: admissionRequest.doctor,
          hospital: admissionRequest.hospital,
          department: admissionRequest.department,
          status: 'Ongoing'
        };
      }
    }

    if (!appointment) throw new Error("Appointment or Admission Request not found.");

    const patient = appointment.patient;
    const hospitalId = appointment.hospital;
    const isIPD = appointment.status === 'Ongoing' || appointment.status === 'Completed';

    const caseIdValue = appointment.caseId || (admissionRequest && admissionRequest.caseId);
    if (!caseIdValue) throw new Error("caseId not found for bill.");

    // Fetch consultation service
    const consultationService = await Service.findOne({ name: 'Consultation', hospital: hospitalId }).session(session);
    if (!consultationService) throw new Error("Consultation service not found.");

    const consultations = await Consultation.find({ caseId, status: "Completed" }).session(session);

    let services = [];

    // Add medication charges if available
    if (medicationCharge) {
      services.push({
        service: medicationCharge.service || null,
        category: medicationCharge.category,
        quantity: medicationCharge.quantity,
        rate: medicationCharge.rate,
        details: medicationCharge.details,
      });
    }

    // Add consultation services
    consultations.forEach(consultation => {
      const consultationRateCategory = consultationService.categories.find(c => c.subCategoryName === "Doctor Consultation");
      const consultationRate = consultationRateCategory ? consultationRateCategory.rate : 0;

      services.push({
        service: consultationService._id,
        category: "Doctor Consultation",
        quantity: 1,
        rate: consultationRate,
        details: {
          consultationData: consultation.consultationData || {},
          doctorName: consultation.doctor.name,  // Add doctor's name
          consultationDate: consultation.date,  // Add consultation date
        },
      });
    });

    // Room & Bed Charges
    let roomAndBedCharges = [];
    if (isIPD) {
      const bed = await Bed.findOne({ assignedPatient: patient._id, status: "Occupied" }).session(session);
      if (bed) {
        const room = await Room.findById(bed.room).session(session);

        const roomService = await Service.findOne({
          hospital: hospitalId,
          "categories.subCategoryName": room.roomType,  // e.g. "Private"
        }).session(session);

        const roomCategory = roomService?.categories.find(
          category => category.subCategoryName === room.roomType
        );
        const roomDetails = roomCategory ? roomCategory.additionaldetails : {};

        const assignedDate = bed?.assignedDate ? new Date(bed?.assignedDate) : null;
        const dischargeDateObj = new Date();
        const daysOccupied = assignedDate ? Math.ceil((dischargeDateObj - assignedDate) / (1000 * 3600 * 24)) : 0;
        const bedCharge = daysOccupied * bed.charges.dailyRate;

        roomAndBedCharges.push({
          service: null,
          category: room?.name || 'Unknown Room',
          quantity: daysOccupied,
          rate: bed.charges.dailyRate,
          details: {
            bedType: bed?.bedType || "Not Specified",
            features: bed?.features || "No features specified",
            bedNumber: bed?.bedNumber || "Not Specified",
            daysOccupied,
            totalCharge: bedCharge,
            roomDetails,
          }
        });
      }
    }

    // ----------------- INSURANCE LOGIC -----------------
    const insuranceApproved = admissionRequest?.admissionDetails?.insurance?.insuranceApproved;
    if (patient.hasInsurance && insuranceApproved === "approved") {
      const insuranceCompany = await InsuranceCompany.findOne({ hospitalId }).session(session);
      if (!insuranceCompany) throw new Error("Insurance company not found.");

      // remap existing services to insurance rates where available
      services = services.map(svc => {
        const insuranceSvc = insuranceCompany.services.find(insSvc => String(insSvc._id) === String(svc.service));
        if (!insuranceSvc) return svc;

        const category = insuranceSvc.categories.find(cat => cat.subCategoryName === svc.category);
        if (!category) return svc;

        return {
          ...svc,
          rate: category.rate, // overwrite with insurance rate
          details: {
            ...svc.details,
            coveredByInsurance: true
          }
        };
      });
    }

    // ----------------- NON-INSURED PATIENTS -----------------
    // For non-insured patients → we DO NOT fetch all hospital services
    // Only use what was already added above: consultations, medications, room/bed charges
    // Nothing extra needs to be pushed for non-insured patients

    const newServices = [...services, ...roomAndBedCharges];

    let bill = await Bill.findOne({ caseId: caseIdValue }).session(session);

    if (!bill) {
      const totalAmount = newServices.reduce((sum, item) => sum + item.quantity * (item.rate || 0), 0);
      bill = new Bill({
        patient: patient._id,
        doctor: appointment.doctor?._id || null,
        caseId: caseIdValue,
        services: newServices,
        totalAmount,
        paidAmount: 0,
        outstanding: totalAmount,
        status: "Pending",
        invoiceNumber: `INV-${Date.now()}`,
        hospital: hospitalId,
        mode: "Cash",
      });
      await bill.save({ session });
    } else {
      bill.services.push(...newServices);

      let newTotal = 0;
      bill.services.forEach(item => {
        newTotal += item.quantity * (item.rate || 0);
      });

      bill.totalAmount = newTotal;
      bill.outstanding = newTotal - bill.paidAmount;

      await bill.save({ session });
    }

    await session.commitTransaction();
    session.endSession();

    return { bill };

  } catch (error) {
    console.error("❌ Error updating bill:", error);
    await session.abortTransaction();
    session.endSession();
    throw new Error("Failed to update bill.");
  }
};

// export const recalculateBillForInsuranceChange = async (caseId) => {
//   const session = await mongoose.startSession();
//   session.startTransaction();

//   try {
//     if (!caseId) throw new Error("Case ID is required for recalculation.");

//     // Find the bill
//     let bill = await Bill.findOne({ caseId }).populate("patient").session(session);
//     if (!bill) throw new Error(`No bill found for caseId: ${caseId}`);

//     const oldTotal = bill.totalAmount;

//     // Get admission details
//     const admission = await AdmissionRequest.findOne({ caseId }).session(session);
//     if (!admission) throw new Error("Admission request not found for bill recalculation.");

//     const insurance = admission.admissionDetails.insurance || {};
//     const insuranceStatus = insurance.insuranceApproved;
//     const hasInsurance = insurance.hasInsurance && insuranceStatus === "approved";

//     // Get rates from insurance company or hospital
//     let serviceRates = {};
//     if (hasInsurance) {
//       console.log(`📌 Patient has insurance approved. Fetching rates from company: ${insurance.insuranceCompany}`);
//       const insuranceCompany = await InsuranceCompany.findOne({
//         name: insurance.insuranceCompany,
//       }).session(session);

//       if (!insuranceCompany) throw new Error("Insurance company not found for insured patient.");

//       insuranceCompany.services.forEach(service => {
//         service.categories.forEach(cat => {
//           serviceRates[cat.subCategoryName] = cat.rate;
//           console.log(`   • Insurance Service Loaded: ${cat.subCategoryName} = ${cat.rate}`);
//         });
//       });

//     } else {
//       console.log("📌 Using hospital service rates.");
//       const services = await Service.find().session(session);
//       services.forEach((srv) => {
//         srv.categories.forEach((cat) => {
//           serviceRates[cat.name] = cat.rate;
//         });
//       });
//     }

//     let newTotal = 0;
//     let serviceLogs = [];

//     bill.services.forEach((srv, index) => {
//       const oldRate = srv.rate;

//       let categoryKey = srv.category;
//       if (srv.category.includes("Room Charges") && srv.details?.bedType) {
//         categoryKey = srv.details.bedType;
//       }

//       const newRate = serviceRates[categoryKey] || oldRate;

//       srv.rate = newRate;

//       // ✅ Update totalCharge inside details
//       if (srv.details) {
//         srv.details.totalCharge = newRate * (srv.quantity || 1);

//         // mark nested Mixed path as modified
//         bill.markModified(`services.${index}.details`);

//       }

//       newTotal += srv.details?.totalCharge || (newRate * (srv.quantity || 1));

//       if (oldRate !== newRate) {
//         const billedDateStr = srv.details?.billedDate
//           ? new Date(srv.details.billedDate).toISOString().split("T")[0]
//           : "N/A";

//         serviceLogs.push(
//           `   • ${srv.category} (Date: ${billedDateStr}) : ${oldRate} → ${newRate}`
//         );
//       }
//     });

//     bill.totalAmount = newTotal;
//     bill.outstanding = newTotal - bill.paidAmount;

//     await bill.save({ session });

//     await session.commitTransaction();
//     session.endSession();

//     console.log(`📌 Service-level changes for caseId=${caseId}:`);
//     if (serviceLogs.length > 0) {
//       serviceLogs.forEach((log) => console.log(log));
//     } else {
//       console.log("   • No rate changes detected.");
//     }

//     console.log(
//       `🔄 Bill recalculated for caseId=${caseId}. Old Total: ${oldTotal}, New Total: ${newTotal}`
//     );

//     return { oldTotal, newTotal, serviceLogs };
//   } catch (error) {
//     console.error("❌ Error recalculating bill:", error);
//     await session.abortTransaction();
//     session.endSession();
//     throw new Error("Failed to recalculate bill after insurance change.");
//   }
// };

export const recalculateBillForInsuranceChange = async (caseId) => {
  const session = await mongoose.startSession();
  session.startTransaction();

  try {
    if (!caseId) throw new Error("Case ID is required for recalculation.");

    // Find the bill
    let bill = await Bill.findOne({ caseId }).populate("patient").session(session);
    if (!bill) throw new Error(`No bill found for caseId: ${caseId}`);

    const oldTotal = bill.totalAmount;

    // Get admission details
    const admission = await AdmissionRequest.findOne({ caseId }).session(session);
    if (!admission) throw new Error("Admission request not found for bill recalculation.");

    const insurance = admission.admissionDetails.insurance || {};
    const insuranceStatus = insurance.insuranceApproved;
    const hasInsurance = insurance.hasInsurance && insuranceStatus === "approved";

    // Determine if insurance rates should be used
    let useInsuranceRates = false;

    switch (insuranceStatus) {
      case "approved":
        useInsuranceRates = true;
        break;
      case "pending":
      case "rejected":
      default:
        useInsuranceRates = false; // hospital rates
    }

    // Get service rates (either insurance or hospital)
    let serviceRates = {};
    if (useInsuranceRates) {
      console.log(`📌 Patient has insurance approved. Fetching rates from company: ${insurance.insuranceCompany}`);
      const insuranceCompany = await InsuranceCompany.findOne({
        name: insurance.insuranceCompany,
      }).session(session);

      if (!insuranceCompany) throw new Error("Insurance company not found for insured patient.");

      // Map the insurance rates based on categories and subCategoryName (bedType)
      insuranceCompany.services.forEach(service => {
        service.categories.forEach(cat => {
          serviceRates[cat.subCategoryName] = cat.rate;
          console.log(`   • Insurance Service Loaded: ${cat.subCategoryName} = ${cat.rate}`);
        });
      });

    } else {
      console.log("📌 Using hospital service rates.");
      const services = await Service.find({ hospital: bill.hospital }).session(session);
      services.forEach((srv) => {
        srv.categories.forEach((cat) => {
          serviceRates[cat.subCategoryName] = cat.rate;
        });
      });
    }

    let newTotal = 0;
    let serviceLogs = [];

    // Update service rates in bill services
    bill.services.forEach((srv, index) => {
      const oldRate = srv.rate;

      let categoryKey = srv.category;

      // Handle room charges based on bedType
      if (srv.category.includes("Room Charges") && srv.details?.bedType) {
        categoryKey = srv.details.bedType;
      }

      // Get the new rate from serviceRates map
      const newRate = serviceRates[categoryKey] || oldRate;
      srv.rate = newRate;

      // Update totalCharge inside details
      if (srv.details) {
        srv.details.totalCharge = newRate * (srv.quantity || 1);

        // Mark the modified path in the nested service details
        bill.markModified(`services.${index}.details`);
      }

      newTotal += srv.details?.totalCharge || (newRate * (srv.quantity || 1));

      // Log the changes if rate has been updated
      if (oldRate !== newRate) {
        const billedDateStr = srv.details?.billedDate
          ? new Date(srv.details.billedDate).toISOString().split("T")[0]
          : "N/A";

        serviceLogs.push(
          `   • ${srv.category} (Date: ${billedDateStr}) : ${oldRate} → ${newRate}`
        );
      }
    });

    // Update totalAmount and outstanding
    bill.totalAmount = newTotal;
    bill.outstanding = newTotal - bill.paidAmount;

    // Save the updated bill
    await bill.save({ session });

    // Commit the transaction
    await session.commitTransaction();
    session.endSession();

    console.log(`📌 Service-level changes for caseId=${caseId}:`);
    if (serviceLogs.length > 0) {
      serviceLogs.forEach((log) => console.log(log));
    } else {
      console.log("   • No rate changes detected.");
    }

    console.log(
      `🔄 Bill recalculated for caseId=${caseId}. Old Total: ${oldTotal}, New Total: ${newTotal}`
    );

    return { oldTotal, newTotal, serviceLogs };
  } catch (error) {
    console.error("❌ Error recalculating bill:", error);
    await session.abortTransaction();
    session.endSession();
    throw new Error("Failed to recalculate bill after insurance change.");
  }
};


