import Bill from '../models/billModel.js';
import InsuranceCompany from '../models/insuranceCompanyModel.js';
import Service from '../models/serviceModel.js';
import Bed from '../models/bedModel.js';
import Room from '../models/roomModel.js';
import Consultation from '../models/consultationModel.js';
import Appointment from '../models/appointmentModel.js';
import AdmissionRequest from '../models/admissionReqModel.js';
import Hospital from '../models/hospitalModel.js';

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
        details: consultation.consultationData || {},
      });
    });

    // Room & Bed Charges
    let roomAndBedCharges = [];
    if (isIPD) {
      const bed = await Bed.findOne({ assignedPatient: patient._id, status: "Occupied" }).session(session);
      if (bed) {
        const room = await Room.findById(bed.room).session(session);

        const roomService = await Service.findOne({ _id: room.roomType }).session(session);
        const roomCategory = roomService?.categories.find(category => category.subCategoryName === room.roomType);
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

      const insuranceServices = insuranceCompany.services.map(service => ({
        ...service,
        categories: service.categories?.map(category => ({
          ...category,
          rate: category.rate
        }))
      }));

      // Add insurance-approved services to bill
      insuranceServices.forEach(service => {
        service.categories?.forEach(category => {
          services.push({
            service: service._id,
            category: category.subCategoryName || "Unknown",
            quantity: 1,
            rate: category.rate,
            details: category.additionaldetails || {}
          });
        });
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
