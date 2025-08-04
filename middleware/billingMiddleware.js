import Bill from "../models/billModel.js";
import Service from "../models/serviceModel.js";
import MedicalRecord from "../models/medicalRecordsModel.js";
import Bed from "../models/bedModel.js";
import Consultation from "../models/consultationModel.js";
import Appointment from "../models/appointmentModel.js";
import Room from "../models/roomModel.js";

export const updateBillAfterAction = async (caseId, session, medicationCharge) => {
  try {
    if (!caseId) throw new Error("Case ID is required.");

    const appointment = await Appointment.findOne({ caseId })
      .populate('patient doctor hospital department')
      .session(session);
    if (!appointment) throw new Error("Appointment not found.");

    const patient = appointment.patient;
    const hospitalId = appointment.hospital;
    const isIPD = appointment.status === 'Ongoing' || appointment.status === 'Completed';

    const consultationService = await Service.findOne({
      name: 'Consultation',
      hospital: hospitalId
    }).session(session);
    if (!consultationService) throw new Error("Consultation service not found.");

    const consultations = await Consultation.find({ caseId, status: "Completed" }).session(session);

    let services = [];

    // ✅ Add medication charges if available
    if (medicationCharge) {
      services.push({
        service: medicationCharge.service || null,
        category: medicationCharge.category,
        quantity: medicationCharge.quantity,
        rate: medicationCharge.rate,
        details: medicationCharge.details,
      });
    }

    // ✅ Add consultation services
    consultations.forEach(consultation => {
      const consultationRateCategory = consultationService.categories.find(
        c => c.subCategoryName === "Doctor Consultation"
      );
      const consultationRate = consultationRateCategory ? consultationRateCategory.rate : 0;

      services.push({
        service: consultationService._id,
        category: "Doctor Consultation",
        quantity: 1,
        rate: consultationRate,
        details: consultation.consultationData || {},
      });
    });

    // ✅ Room & Bed Charges (IPD)
    let roomAndBedCharges = [];
    if (isIPD) {
      const bed = await Bed.findOne({ assignedPatient: patient._id, status: "Occupied" }).session(session);
      if (bed) {
        const room = await Room.findById(bed.room).session(session);

        // Calculate the number of days the bed was occupied
        const assignedDate = bed?.assignedDate ? new Date(bed?.assignedDate) : null;
        const dischargeDateObj = new Date();  // Use current date if dischargeDate isn't provided

        const daysOccupied = assignedDate ? Math.ceil((dischargeDateObj - assignedDate) / (1000 * 3600 * 24)) : 0;

        // Calculate the bed charge based on daily rate and occupied days
        const bedCharge = daysOccupied * bed.charges.dailyRate;

        // Push the bed charge into the services array
        roomAndBedCharges.push({
          service: null,  // No service ID for room & bed
          category: room?.name || 'Unknown Room',
          quantity: daysOccupied,  // Quantity = number of days occupied
          rate: bed.charges.dailyRate,  // Daily rate from the bed model
          details: {
            bedType: bed?.bedType || "Not Specified",
            features: bed?.features || "No features specified",
            bedNumber: bed?.bedNumber || "Not Specified",
            daysOccupied,  // Added for reference
            totalCharge: bedCharge,  // Total charge for the bed occupancy
          }
        });
      }
    }

    // ✅ Diagnostics from consultations
    const diagnostics = consultations.flatMap(consultation => {
      return consultation.consultationData?.diagnosis ? [{
        service: 'Lab Tests',
        category: consultation.consultationData.diagnosis,
        quantity: 1,
        rate: 0,
        details: {
          diagnosis: consultation.consultationData.diagnosis || "No diagnosis specified",
        }
      }] : [];
    });

    const newServices = [...services, ...roomAndBedCharges, ...diagnostics];

    let bill = await Bill.findOne({ caseId }).session(session);

    if (!bill) {
      // Create a new bill
      const totalAmount = newServices.reduce((sum, item) => sum + item.quantity * (item.rate || 0), 0);

      bill = new Bill({
        patient: patient._id,
        doctor: appointment.doctor._id,
        caseId: appointment.caseId,
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
      // ✅ Update the bill
      bill.services.push(...newServices);

      // ✅ Recalculate total after pushing services
      let newTotal = 0;
      bill.services.forEach(item => {
        newTotal += item.quantity * (item.rate || 0);
      });

      bill.totalAmount = newTotal;
      bill.outstanding = newTotal - bill.paidAmount;

      await bill.save({ session });
    }

    await session.commitTransaction();  // Commit the transaction here
    session.endSession();

    return { bill };

  } catch (error) {
    console.error("❌ Error updating bill:", error);
    await session.abortTransaction();  // Abort if error occurs
    session.endSession();
    throw new Error("Failed to update bill.");
  }
};

