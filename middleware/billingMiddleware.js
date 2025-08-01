import Bill from "../models/billModel.js";
import Service from "../models/serviceModel.js";  // Import Service model to get service categories
import MedicalRecord from "../models/medicalRecordsModel.js"; // For medications
import Bed from "../models/bedModel.js";  // For IPD bed charges
import Consultation from "../models/consultationModel.js"; // To fetch consultations
import Appointment from "../models/appointmentModel.js";  // For caseId
import Room from "../models/roomModel.js";  // For room charges

export const updateBillAfterAction = async (caseId, session, medicationCharge) => {
  try {
    if (!caseId) {
      throw new Error("Case ID is required to update the bill.");
    }

    // Fetch the appointment using the caseId
    const appointment = await Appointment.findOne({ caseId })
      .populate('patient doctor hospital department')
      .session(session);
    if (!appointment) {
      throw new Error("Appointment not found.");
    }

    const patient = appointment.patient;
    const hospitalId = appointment.hospital;
    const isIPD = appointment.status === 'Ongoing' || appointment.status === 'Completed';

    // Fetch the consultation service (Doctor Consultation) from the Service model
    const consultationService = await Service.findOne({
      name: 'Consultation',
      hospital: hospitalId
    }).session(session);
    if (!consultationService) {
      throw new Error("Consultation service not found.");
    }

    // Fetch completed consultations for this caseId
    const consultations = await Consultation.find({ caseId: caseId, status: "Completed" }).session(session);

    // Initialize services array
    let services = [];

    // Add medication charge if available
    if (medicationCharge) {
      services.push({
        service: medicationCharge.service || null,  // Medication service reference (_id) or null
        category: medicationCharge.category,
        quantity: medicationCharge.quantity,
        rate: medicationCharge.rate,  // Dynamic rate fetched from Service model
        details: medicationCharge.details,  // Medication details
      });
    }

    // Add consultations to services with proper rate
    consultations.forEach(consultation => {
      const consultationRateCategory = consultationService.categories.find(
        category => category.subCategoryName === "Doctor Consultation"
      );

      let consultationRate = 0; // Default rate to 0
      if (consultationRateCategory) {
        consultationRate = consultationRateCategory.rate; // Use the rate from the category
      }

      // Push consultation service with rate into services
      services.push({
        service: consultationService._id, // Add consultation service (_id)
        category: "Doctor Consultation", // Category for consultation
        quantity: 1,
        rate: consultationRate,  // Use the rate from Service model
        details: consultation.consultationData || {},  // Use the entire consultationData as details
      });
    });

    // Step 5: Prepare room and bed charges for IPD
    let roomAndBedCharges = [];
    if (isIPD) {
      const bed = await Bed.findOne({ assignedPatient: patient._id, status: "Occupied" }).session(session);
      if (bed) {
        const room = await Room.findById(bed.room).session(session);
        roomAndBedCharges.push({
          service: 'Room and Bed',
          category: room.name,
          quantity: 1,
          rate: 0,  // Will be updated later
          details: {
            bedType: bed.bedType || "Not Specified",
            features: bed.features || "No features specified",
            bedNumber: bed.bedNumber || "Not Specified",
          }
        });
      }
    }

    // Step 6: Prepare diagnostics/lab test charges (if any)
    const diagnostics = consultations.flatMap(consultation => {
      return consultation.consultationData.diagnosis ? [{
        service: 'Lab Tests',
        category: consultation.consultationData.diagnosis,
        quantity: 1,
        rate: 0,
        details: {
          diagnosis: consultation.consultationData.diagnosis || "No diagnosis specified",  // Ensure default values
        }
      }] : [];
    });

    // Recalculate total amount based on the updated services array
    let totalAmount = 0;
    services.forEach(item => {
      totalAmount += item.quantity * item.rate;
    });
    roomAndBedCharges.forEach(item => {
      totalAmount += item.quantity * item.rate;
    });
    diagnostics.forEach(item => {
      totalAmount += item.quantity * item.rate;
    });

    // Check if the bill already exists
    let bill = await Bill.findOne({ caseId }).session(session);

    if (!bill) {
      // Create a new bill if it doesn't exist
      bill = new Bill({
        patient: patient._id,
        doctor: appointment.doctor._id,
        caseId: appointment.caseId,
        services: [...services, ...roomAndBedCharges, ...diagnostics],  // Add all services to the bill
        totalAmount: totalAmount,
        paidAmount: 0,
        outstanding: totalAmount,
        status: "Pending",
        invoiceNumber: `INV-${Date.now()}`,
        hospital: hospitalId,
        mode: "Cash",
      });

      await bill.save({ session });
    } else {
      // Update the bill if it already exists by adding new services
      bill.services.push(...services, ...roomAndBedCharges, ...diagnostics);  // Push new services into the existing array
      bill.totalAmount = totalAmount;
      bill.outstanding = totalAmount - bill.paidAmount;

      await bill.save({ session });
    }

    // Commit the transaction after the bill is created or updated
    await session.commitTransaction();  // Commit the transaction here
    session.endSession();

    return { bill };

  } catch (error) {
    console.error("Error updating bill:", error);
    await session.abortTransaction();  // Abort if error occurs
    session.endSession();
    throw new Error("Error updating bill.");
  }
};

