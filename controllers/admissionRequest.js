import PDFDocument from "pdfkit";
import bcrypt from "bcryptjs";
import mongoose from "mongoose";
import { updateBillAfterAction, recalculateBillForInsuranceChange } from "../middleware/billingMiddleware.js"; // Import the billing middleware function

import AdmissionRequest from '../models/admissionReqModel.js';
import Bed from '../models/bedModel.js';
import Room from '../models/roomModel.js';
import Patient from '../models/patientModel.js';
import Consultation from '../models/consultationModel.js';
import Discharge from '../models/DischargeModel.js';
import Appointment from '../models/appointmentModel.js';
import Service from '../models/serviceModel.js';
import InsuranceCompany from '../models/insuranceCompanyModel.js';
import Hospital from '../models/hospitalModel.js';
import Bill from '../models/billModel.js';

// Create admission request and create a new bill upon admission
export const createAdmissionRequest = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId)
      return res.status(403).json({ message: "No hospital context found." });

    const { patId, doctor, sendTo, admissionDetails, hasInsurance } = req.body;
    const createdBy = req.user._id;

    let patient;
    let generatedCaseId = null;

    // Step 1: Check if patient exists
    if (patId) {
      patient = await Patient.findOne({ patId, hospital: hospitalId });
    }

    // Step 2: Determine caseId for existing patient (from latest appointment only)
    if (patient) {
      const latestAppointment = await Appointment.findOne({
        patient: patient._id,
        status: { $in: ["Ongoing", "Scheduled"] }
      })
        .sort({ createdAt: -1 })
        .select('caseId');


      generatedCaseId = latestAppointment?.caseId;

      // If no appointment exists, generate a new caseId
      if (!generatedCaseId) {
        const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
        const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
        generatedCaseId = `CASE-${datePart}-${randomPart}`;
      }
    } else {
      // New patient → generate caseId
      const datePart = new Date().toISOString().slice(0, 10).replace(/-/g, "");
      const randomPart = Math.random().toString(36).substring(2, 8).toUpperCase();
      generatedCaseId = `CASE-${datePart}-${randomPart}`;
    }

    // Step 3: Validate room
    const room = await Room.findOne({ roomID: admissionDetails.room, hospital: hospitalId });
    if (!room) return res.status(404).json({ message: "Room not found with given roomID." });

    // Step 4: Validate bed (must be available)
    const bed = await Bed.findOne({
      bedNumber: admissionDetails.bed,
      hospital: hospitalId,
      room: room._id,
      status: "Available",
    });
    if (!bed)
      return res
        .status(409)
        .json({ message: "Bed not available. Already reserved or occupied." });

    // Step 5: If patient doesn't exist, register
    if (!patient) {
      const { name, mobileNumber, email } = req.body;
      if (!name || !mobileNumber || !email)
        return res
          .status(400)
          .json({ message: "Missing patient registration details." });

      // Validate insurance fields if enabled
      if (hasInsurance === true || hasInsurance === "true") {
        const requiredFields = [
          "insuranceIdNumber",
          "policyNumber",
          "insuranceCompany",
          "employeeCode",
          "insuranceStartDate",
          "insuranceExpiryDate",
        ];
        for (const field of requiredFields) {
          if (!req.body[field])
            return res
              .status(400)
              .json({ message: `Missing required insurance field: ${field}` });
        }
      }

      const defaultPassword = "changeme";
      const hashedPassword = await bcrypt.hash(defaultPassword, 10);

      patient = new Patient({
        name,
        email,
        phone: mobileNumber,
        hospital: hospitalId,
        password: hashedPassword,
        status: "active",
        hasInsurance: hasInsurance === true || hasInsurance === "true",
        insuranceDetails:
          hasInsurance === true || hasInsurance === "true"
            ? {
              employerName: req.body.employerName,
              insuranceIdNumber: req.body.insuranceIdNumber,
              policyNumber: req.body.policyNumber,
              insuranceCompany: req.body.insuranceCompany,
              employeeCode: req.body.employeeCode,
              insuranceStartDate: req.body.insuranceStartDate,
              insuranceExpiryDate: req.body.insuranceExpiryDate,
              insuranceApproved: "pending", // ✅ default for new patient
            }
            : undefined,
      });

      await patient.save();
      console.log(`✅ New patient registered: ${patient.patId}`);
    }

    // Step 5b: Ensure existing patients have insuranceApproved if missing
    if (patient.hasInsurance && !patient.insuranceDetails?.insuranceApproved) {
      patient.insuranceDetails = {
        ...patient.insuranceDetails,
        insuranceApproved: "pending",
      };
      await patient.save();
    }

    // Step 6: Construct admission details
    const insurancePayload = {
      hasInsurance: hasInsurance === true || hasInsurance === "true",
      employerName: req.body.employerName || "",
      insuranceIdNumber: req.body.insuranceIdNumber || "",
      policyNumber: req.body.policyNumber || "",
      insuranceCompany: req.body.insuranceCompany || "",
      employeeCode: req.body.employeeCode || "",
      insuranceStartDate: req.body.insuranceStartDate || null,
      insuranceExpiryDate: req.body.insuranceExpiryDate || null,
      insuranceApproved:
        hasInsurance === true || hasInsurance === "true" ? "pending" : null, // ✅ guaranteed
    };

    const admissionData = {
      ...admissionDetails,
      room: room._id,
      bed: bed._id,
      date: admissionDetails.date || admissionDetails.admissionDate,
      time: admissionDetails.time || admissionDetails.admissionTime,
      insurance: insurancePayload,
    };
    delete admissionData.admissionDate;

    const autoApprove = sendTo === "None";

    // Step 7: Create AdmissionRequest
    const request = await AdmissionRequest.create({
      patient: patient._id,
      hospital: hospitalId,
      doctor,
      createdBy,
      sendTo,
      caseId: generatedCaseId,
      admissionDetails: admissionData,
      ...(autoApprove ? { status: "Approved" } : {}),
      ...(autoApprove
        ? {
          approval: {
            doctor: {
              approved: true,
              signature: "AUTO",
              approvedAt: new Date(),
            },
            admin: {
              approved: true,
              signature: "AUTO",
              approvedAt: new Date(),
            },
          },
        }
        : {}),
    });

    // ✅ Step 8: Reserve bed only after AdmissionRequest creation
    bed.status = "Reserved";
    await bed.save();

    // Step 9: Generate a unique invoice number
    const invoiceNumber = `INV-${generatedCaseId}-${Date.now()}`;

    // Step 10: Create the bill at the time of admission
    const bill = new Bill({
      patient: patient._id,
      caseId: generatedCaseId,
      services: [], // Initially no services, can be updated later
      totalAmount: 0,
      paidAmount: 0,
      outstanding: 0,
      status: "Pending",
      invoiceNumber: invoiceNumber,
      hospital: hospitalId,
      mode: "Cash",
    });

    await bill.save();

    res.status(201).json({
      message: "Admission request and bill created successfully",
      request,
      bill,
      patient: {
        name: patient.name,
        patId: patient.patId,
      },
    });
  } catch (error) {
    console.error("Error creating admission request:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

export const approveAdmissionRequest = async (req, res) => {
  try {
    const { requestId } = req.params;
    const { role } = req.user;
    const { signature } = req.body;

    const admissionRequest = await AdmissionRequest.findById(requestId);
    if (!admissionRequest) {
      return res.status(404).json({ message: "Admission request not found." });
    }

    if (
      (role === "doctor" &&
        ["Doctor", "Both"].includes(admissionRequest.sendTo)) ||
      (role === "hospitalAdmin" &&
        ["Admin", "Both"].includes(admissionRequest.sendTo)) // NOTE: sendTo uses "Admin"
    ) {
      // Update approval object correctly
      if (role === "doctor") {
        admissionRequest.approval.doctor = {
          approved: true,
          signature,
          approvedAt: new Date(),
        };
      }

      if (role === "hospitalAdmin") {
        admissionRequest.approval.admin = {
          approved: true,
          signature,
          approvedAt: new Date(),
        };
      }

      // Check if status should be marked as Approved
      const isApproved =
        (admissionRequest.sendTo === "Both" &&
          admissionRequest.approval.doctor?.approved &&
          admissionRequest.approval.admin?.approved) ||
        (admissionRequest.sendTo === "Doctor" &&
          admissionRequest.approval.doctor?.approved) ||
        (admissionRequest.sendTo === "Admin" &&
          admissionRequest.approval.admin?.approved);

      if (isApproved) {
        admissionRequest.status = "Approved";
      }

      await admissionRequest.save();

      return res.status(200).json({
        message: `Admission request ${role} approval successful.`,
        status: admissionRequest.status,
        approval: admissionRequest.approval,
      });
    } else {
      return res
        .status(403)
        .json({ message: "Not authorized to approve this request." });
    }
  } catch (error) {
    console.error("Error approving admission request:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const admitPatient = async (req, res) => {
  const session = await AdmissionRequest.startSession();
  session.startTransaction();

  try {
    const { requestId } = req.params;

    const admissionRequest = await AdmissionRequest.findById(requestId)
      .populate("patient")
      .populate("admissionDetails.bed")
      .populate("admissionDetails.room")
      .session(session);

    if (!admissionRequest) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Admission request not found." });
    }

    if (admissionRequest.status !== "Approved") {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Admission request is not yet approved." });
    }

    const roomId =
      admissionRequest.admissionDetails.room?._id ||
      admissionRequest.admissionDetails.room;
    const bedId =
      admissionRequest.admissionDetails.bed?._id ||
      admissionRequest.admissionDetails.bed;

    if (!roomId || !bedId) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({
          message: "Room or bed reference missing in admission details.",
        });
    }

    const room = await Room.findById(roomId).session(session);
    const bed = await Bed.findById(bedId).session(session);

    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({ message: "Room not found." });
    }

    if (!bed || !["Available", "Reserved"].includes(bed.status)) {
      await session.abortTransaction();
      return res
        .status(400)
        .json({ message: "Bed is not available or reserved." });
    }

    // ✅ Update patient admission status
    const updatedPatient = await Patient.findOneAndUpdate(
      { _id: admissionRequest.patient._id },
      { admissionStatus: "Admitted" },
      { session, new: true }
    );

    if (!updatedPatient) {
      await session.abortTransaction();
      return res
        .status(500)
        .json({ message: "Failed to update patient admission status." });
    }

    // ✅ Assign bed to patient
    bed.status = "Occupied";
    bed.assignedPatient = admissionRequest.patient._id;
    bed.assignedDate = new Date();
    await bed.save({ session });

    // ✅ Update room bed availability
    await room.updateAvailableBeds();

    // ✅ Finalize admission request
    admissionRequest.status = "Admitted";
    await admissionRequest.save({ session });

    // ✅ START LIVE BILLING
    const bill = await Bill.findOne({ caseId: admissionRequest.caseId }).session(session);
    if (bill) {
      bill.isLive = true;
      bill.lastBilledAt = new Date();
      await bill.save({ session });
    }

    await session.commitTransaction();

    res.status(200).json({
      message: "Patient successfully admitted.",
      admissionRequestId: admissionRequest._id,
      updatedPatient: {
        id: updatedPatient._id,
        name: updatedPatient.name,
        admissionStatus: updatedPatient.admissionStatus,
      },
    });
  } catch (error) {
    await session.abortTransaction();
    console.error("Error admitting patient:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  } finally {
    session.endSession();
  }
};

export const getAdmissionRequests = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context found." });
    }

    const statusFilter = req.query.status;

    const filter = {
      hospital: hospitalId,
    };

    if (statusFilter && statusFilter !== "all" && statusFilter !== "") {
      filter.status = statusFilter;
    }

    const requests = await AdmissionRequest.find(filter)
      .populate({
        path: "patient",
        select: "name age contact phone admissionStatus",
        match: { admissionStatus: { $ne: "Admitted" } }, // 💥 exclude admitted patients
      })
      .populate("doctor", "name email")
      .populate("admissionDetails.room", "name roomType")
      .populate("admissionDetails.bed", "bedNumber bedType status");

    // Filter out null patients (those who were excluded by match)
    const filteredRequests = requests.filter((r) => r.patient !== null);

    const mappedRequests = filteredRequests.map((r) => r.toObject());

    res.status(200).json({
      message: "Admission requests fetched successfully.",
      count: filteredRequests.length,
      requests: mappedRequests,
    });
  } catch (error) {
    console.error("Error fetching admission requests:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getApprovedAdmissions = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId)
      return res.status(403).json({ message: "No hospital context found." });

    const approvedRequests = await AdmissionRequest.find({
      hospital: hospitalId,
      status: "Approved",
    })
      .populate("patient", "name age contact admissionStatus")
      .populate("doctor", "name email")
      .populate("admissionDetails.room", "name roomType")
      .populate("admissionDetails.bed", "bedNumber bedType status");

    res.status(200).json({
      message: "Approved admission requests fetched successfully.",
      count: approvedRequests.length,
      requests: approvedRequests,
    });
  } catch (error) {
    console.error("Error fetching approved admissions:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getAdmittedPatients = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context found." });
    }

    const patientMap = {};

    // Step 1: Get all admitted patients, including healthStatus
    const admitted = await Patient.find({
      hospital: hospitalId,
      admissionStatus: "Admitted",
    }).select("name contact phone admissionStatus healthStatus");

    // Step 2: Get their IDs
    const admittedPatientIds = admitted.map((p) => p._id);

    // Step 3: Fetch related admission requests
    const admissionRequests = await AdmissionRequest.find({
      patient: { $in: admittedPatientIds },
      status: "Admitted",
    })
      .sort({ createdAt: -1 }) // get the latest
      .select(
        "patient caseId admissionDetails.medicalNote admissionDetails.date admissionDetails.gender admissionDetails.age createdAt"
      )
      .lean();

    // Step 4: Create map for admissionDetails
    const admissionDataMap = {};
    admissionRequests.forEach((req) => {
      admissionDataMap[req.patient.toString()] = {
        caseId: req.caseId,
        medicalNote: req.admissionDetails?.medicalNote || null,
        date: req.admissionDetails?.date || null,
        gender: req.admissionDetails?.gender || null,
        age: req.admissionDetails?.age || null,
      };
    });

    // Step 5: Construct admitted map with healthStatus and admission data
    admitted.forEach((p) => {
      const id = p._id.toString();

      patientMap[id] = {
        ...p.toObject(),
        ...admissionDataMap[id], // adds medicalNote and date
        type: "admitted",
      };
    });

    // Step 6: Follow-up consultations
    const followUpConsultations = await Consultation.find({
      followUpRequired: true,
    }).select("patient caseId");

    const followUpPatientIds = [
      ...new Set(followUpConsultations.map((c) => c.patient.toString())),
    ];

    const followUpPatients = await Patient.find({
      hospital: hospitalId,
      _id: { $in: followUpPatientIds },
    }).select("name contact phone admissionStatus healthStatus");

    followUpPatients.forEach((p) => {
      const id = p._id.toString();
      if (patientMap[id]) {
        patientMap[id].type += "+followup";
      } else {
        patientMap[id] = { ...p.toObject(), type: "followup" };
      }
    });

    // Step 7: Compare caseIds between admission and consultation
    const finalPatients = Object.values(patientMap);

    for (let patient of finalPatients) {
      const patientId = patient._id;

      // Fetch the latest consultation for the patient
      const latestConsultation = await Consultation.findOne({
        patient: patientId,
      })
        .sort({ date: -1 })
        .select("caseId"); // Get the latest consultation's caseId

      // Fetch the latest admission request for the patient
      const latestAdmissionRequest = await AdmissionRequest.findOne({
        patient: patientId,
      })
        .sort({ createdAt: -1 })
        .select("caseId"); // Get the latest admission's caseId

      let latestCaseId = "";

      // Compare caseIds from admission and consultation
      if (latestConsultation && latestAdmissionRequest) {
        // Compare both caseIds based on the most recent entry (using createdAt for admission)
        const latestConsultationDate = new Date(latestConsultation.createdAt);
        const latestAdmissionRequestDate = new Date(
          latestAdmissionRequest.createdAt
        );

        // If admission request was created later
        if (latestAdmissionRequestDate > latestConsultationDate) {
          latestCaseId = latestAdmissionRequest.caseId;
        } else {
          latestCaseId = latestConsultation.caseId;
        }
      } else if (latestConsultation) {
        latestCaseId = latestConsultation.caseId;
      } else if (latestAdmissionRequest) {
        latestCaseId = latestAdmissionRequest.caseId;
      }

      // Add the latest caseId to the patient
      patient.latestCaseId = latestCaseId;
    }

    res.status(200).json({
      message:
        "Admitted, follow-up, and critical patients fetched successfully.",
      count: finalPatients.length,
      patients: finalPatients,
    });
  } catch (error) {
    console.error("Error fetching tracked patients:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const getAdmissionRequestsWithInsurance = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res
        .status(403)
        .json({ message: "Unauthorized: No hospital context." });
    }

    // Fetch all admission requests for the hospital with insurance
    const requests = await AdmissionRequest.find({
      hospital: hospitalId,
      "admissionDetails.insurance.hasInsurance": true,
    })
      .populate(
        "patient",
        "name patId email phone hasInsurance insuranceDetails"
      )
      .populate("admissionDetails.room", "roomID")
      .populate("admissionDetails.bed", "bedNumber")
      .populate("doctor", "name specialization")
      .sort({ createdAt: -1 })
      .lean(); // Convert to plain objects

    if (!requests || requests.length === 0) {
      return res.status(404).json({ message: "No insured admissions found." });
    }

    // Ensure insuranceApproved is always present and include the AdmissionRequest _id
    const dataWithInsuranceApproved = requests.map((admission) => {
      if (
        admission.admissionDetails.insurance &&
        !admission.admissionDetails.insurance.insuranceApproved
      ) {
        admission.admissionDetails.insurance.insuranceApproved = "pending";
      }

      // Make sure _id of AdmissionRequest is returned explicitly
      return {
        _id: admission._id,
        ...admission,
      };
    });

    res.status(200).json({
      message: "Insured admission requests retrieved successfully.",
      count: dataWithInsuranceApproved.length,
      data: dataWithInsuranceApproved,
    });
  } catch (error) {
    console.error("❌ Error fetching insured admissions:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};


export const updateInsuranceStatus = async (req, res) => {
  try {
    const { admissionId } = req.params;
    const { insuranceApproved, amountApproved } = req.body;

    const validStatuses = ['pending', 'approved', 'rejected'];
    if (insuranceApproved && !validStatuses.includes(insuranceApproved)) {
      return res.status(400).json({
        message: "Invalid insuranceApproved value. Must be 'pending', 'approved', or 'rejected'."
      });
    }

    const admissionRequest = await AdmissionRequest.findById(admissionId);
    if (!admissionRequest) {
      return res.status(404).json({ message: "Admission request not found." });
    }

    if (!admissionRequest.admissionDetails.insurance?.hasInsurance) {
      return res.status(400).json({ message: "Patient does not have insurance." });
    }

    const oldStatus = admissionRequest.admissionDetails.insurance.insuranceApproved;

    // ✅ Update insuranceApproved if passed
    if (insuranceApproved) {
      admissionRequest.admissionDetails.insurance.insuranceApproved = insuranceApproved;
    }

    // ✅ Update amountApproved if passed
    if (amountApproved !== undefined) {
      if (amountApproved < 0) {
        return res.status(400).json({ message: "amountApproved cannot be negative." });
      }
      admissionRequest.admissionDetails.insurance.amountApproved = amountApproved;
    }

    await admissionRequest.save();

    console.log(
      `📌 Insurance status changed for caseId=${admissionRequest.caseId}: ${oldStatus} → ${admissionRequest.admissionDetails.insurance.insuranceApproved}`
    );

    // 🔄 Trigger bill recalculation (retroactive overwrite)
    let billChanges = null;
    try {
      billChanges = await recalculateBillForInsuranceChange(admissionRequest.caseId);
    } catch (err) {
      console.error("❌ Error recalculating bill after insurance change:", err);
    }

    res.status(200).json({
      message: `Insurance details updated and bill recalculated.`,
      insurance: admissionRequest.admissionDetails.insurance,
      billChanges
    });
  } catch (error) {
    console.error("❌ Error updating insurance status:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



// export const dischargePatient = async (req, res) => {
//   try {
//     const {
//       patientId,
//       caseId,
//       admissionDate,
//       dischargeDate,
//       onAdmissionNotes,
//       onDischargeNotes,
//       diagnosis,
//       followUpDay,
//       followUpTime
//     } = req.body;

//     // 1️⃣ Find patient
//     const patient = await Patient.findById(patientId);
//     if (!patient) return res.status(404).json({ message: 'Patient not found' });

//     // 2️⃣ Save discharge summary
//     const discharge = new Discharge({
//       patient: patientId,
//       caseId,
//       admissionDate,
//       dischargeDate,
//       onAdmissionNotes,
//       onDischargeNotes,
//       diagnosis,
//       followUpDay,
//       followUpTime
//     });
//     await discharge.save();

//     // 3️⃣ Update admission request / appointment
//     let appointmentDoc = await Appointment.findOne({ caseId });
//     let admissionRequestDoc = null;

//     if (!appointmentDoc) {
//       admissionRequestDoc = await AdmissionRequest.findOne({ caseId });
//       if (!admissionRequestDoc) {
//         return res.status(404).json({ message: "Case ID not found in either Appointment or Admission Request." });
//       }
//     }

//     if (admissionRequestDoc) {
//       admissionRequestDoc.status = 'discharged';
//       await admissionRequestDoc.save();
//     }

//     // 4️⃣ Free the bed
//     const bed = await Bed.findOne({ assignedPatient: patientId });
//     if (bed) {
//       bed.status = 'Available';
//       bed.assignedPatient = null;
//       bed.dischargeDate = dischargeDate;
//       await bed.save();
//     }

//     // 5️⃣ Update patient status
//     patient.admissionStatus = 'Not Admitted';
//     await patient.save();

//     // 6️⃣ Calculate room charges and final adjustments
//     const bill = await Bill.findOne({ caseId });

//     if (bill && bill.isLive) {
//       const lastBilledAt = new Date(bill.lastBilledAt); // Last billed date
//       const dischargeDateObj = new Date(dischargeDate); // Discharge date

//       // Normalize dates to YYYY-MM-DD (ignore time)
//       const startDate = new Date(lastBilledAt);
//       startDate.setHours(0, 0, 0, 0);

//       const endDate = new Date(dischargeDateObj);
//       endDate.setHours(0, 0, 0, 0);

//       // Start from the next day after last billed
//       startDate.setDate(startDate.getDate() + 1);

//       // Loop until the day before discharge
//       for (
//         let d = new Date(startDate);
//         d <= endDate;
//         d.setDate(d.getDate() + 1)
//       ) {
//         const billedDateStr = d.toISOString().split("T")[0];

//         // Skip if already billed
//         const existingEntry = bill.services.find(
//           (s) => s.details?.billedDate === billedDateStr
//         );
//         if (existingEntry) continue;

//         // Insurance check
//         let rateToApply = bed.charges.dailyRate;
//         if (
//           patient.hasInsurance &&
//           admissionRequestDoc?.admissionDetails?.insurance?.insuranceApproved ===
//           "approved"
//         ) {
//           const insuranceCompany = await InsuranceCompany.findOne({
//             name: patient.insuranceDetails?.insuranceCompany,
//           });
//           if (insuranceCompany) {
//             const roomService = insuranceCompany.services.find(
//               (srv) => srv.serviceName === "Room Type Service"
//             );
//             const roomCategory = roomService?.categories.find(
//               (cat) => cat.subCategoryName === bed.roomType
//             );
//             if (roomCategory) {
//               rateToApply = roomCategory.rate;
//             }
//           }
//         }

//         bill.services.push({
//           service: null,
//           category: "Room Charges (Final Adjustment)",
//           quantity: 1,
//           rate: rateToApply,
//           details: {
//             bedNumber: bed.bedNumber,
//             daysOccupied: 1,
//             totalCharge: rateToApply,
//             billedDate: billedDateStr,
//           },
//         });

//         // Increment total amount only for newly added entries
//         bill.totalAmount += rateToApply;
//       }

//       // Update outstanding after final adjustments
//       bill.outstanding = bill.totalAmount - bill.paidAmount;

//       // Stop live billing once discharge is finalized
//       bill.isLive = false;
//       await bill.save();
//     }

//     res.status(200).json({ message: 'Patient discharged successfully', discharge });

//   } catch (error) {
//     console.error('Error discharging patient:', error);
//     res.status(500).json({ message: 'Internal server error', error: error.message });
//   }
// };

export const dischargePatient = async (req, res) => {
  try {
    const {
      patientId,
      caseId,
      admissionDate,
      dischargeDate,
      onAdmissionNotes,
      onDischargeNotes,
      diagnosis,
      followUpDay,
      followUpTime,
    } = req.body;

    // 1️⃣ Find patient
    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ message: "Patient not found" });

    // 2️⃣ Save discharge summary
    const discharge = new Discharge({
      patient: patientId,
      caseId,
      admissionDate,
      dischargeDate,
      onAdmissionNotes,
      onDischargeNotes,
      diagnosis,
      followUpDay,
      followUpTime,
    });
    await discharge.save();

    // 3️⃣ Update admission request / appointment
    let admissionRequest = await AdmissionRequest.findOne({ caseId });
    if (admissionRequest) {
      admissionRequest.status = 'discharged';
      await admissionRequest.save();
    } else {
      // Try to mark the appointment as completed if it exists
      const appointment = await Appointment.findOne({ caseId });
      if (appointment) {
        appointment.status = 'completed';
        await appointment.save();
      }
    }

    // 4️⃣ Free the bed & fetch room
    const bed = await Bed.findOne({ assignedPatient: patientId });
    let room = null;
    if (bed) {
      room = await Room.findById(bed.room);
      bed.status = "Available";
      bed.assignedPatient = null;
      bed.dischargeDate = dischargeDate;
      await bed.save();
    }

    // 5️⃣ Update patient status
    patient.admissionStatus = "Not Admitted";
    await patient.save();

    // 6️⃣ Calculate room charges and final adjustments
    const bill = await Bill.findOne({ caseId });

    if (bill && bill.isLive && bed && room) {
      const lastBilledAt = new Date(bill.lastBilledAt);
      const dischargeDateObj = new Date(dischargeDate);

      // Normalize dates
      const startDate = new Date(lastBilledAt);
      startDate.setHours(0, 0, 0, 0);

      // check if lastBilledAt day already exists in bill.services
      const lastBilledDateStr = startDate.toISOString().split("T")[0];
      const alreadyBilled = bill.services.some(s => s.details?.billedDate === lastBilledDateStr);

      // if already billed, move to next day; else include lastBilledAt day
      if (alreadyBilled) {
        startDate.setDate(startDate.getDate() + 1);
      }

      const endDate = new Date(dischargeDateObj);
      endDate.setHours(0, 0, 0, 0);

      const roomType = room.roomType;

      for (let d = new Date(startDate); d <= endDate; d.setDate(d.getDate() + 1)) {
        const billedDateStr = d.toISOString().split("T")[0];

        // Skip duplicates
        const existingEntry = bill.services.find((s) => s.details?.billedDate === billedDateStr);
        if (existingEntry) continue;

        let rateToApply = bed.charges.dailyRate;
        let roomDetails = {};

        // ✅ Insurance check
        if (
          patient.hasInsurance &&
          admissionRequest?.admissionDetails?.insurance?.insuranceApproved === "approved"
        ) {
          const insuranceCompany = await InsuranceCompany.findOne({
            name: patient.insuranceDetails?.insuranceCompany,
          });
          if (insuranceCompany) {
            const roomService = insuranceCompany.services.find(
              (srv) => srv.serviceName === "Room Type Service"
            );
            const roomCategory = roomService?.categories.find(
              (cat) => cat.subCategoryName === roomType
            );
            if (roomCategory) {
              rateToApply = roomCategory.rate;
              roomDetails = roomCategory.additionaldetails || {};
            }
          }
        }

        // ✅ Fallback to hospital service if insurance not applied
        if (rateToApply === bed.charges.dailyRate && roomType) {
          const hospitalService = await Service.findOne({
            hospital: bed.hospital,
            "categories.subCategoryName": roomType,
          });
          const roomCategory = hospitalService?.categories.find(
            (c) => c.subCategoryName === roomType
          );
          if (roomCategory) {
            rateToApply = roomCategory.rate;
            roomDetails = roomCategory.additionaldetails || {};
          }
        }

        // ✅ Push final room charge
        bill.services.push({
          service: null,
          category: "Room Charges discharge",
          quantity: 1,
          rate: rateToApply,
          details: {
            bedNumber: bed.bedNumber,
            daysOccupied: 1,
            totalCharge: rateToApply,
            billedDate: billedDateStr,
            bedType: room?.roomType || bed?.bedType || "Not Specified",
            features: bed?.features || {},
            roomDetails,
          },
        });

        bill.totalAmount += rateToApply;
      }

      bill.outstanding = bill.totalAmount - bill.paidAmount;
      bill.isLive = false; // stop live billing
      await bill.save();
    }

    res.status(200).json({ message: "Patient discharged successfully", discharge });
  } catch (error) {
    console.error("Error discharging patient:", error);
    res
      .status(500)
      .json({ message: "Internal server error", error: error.message });
  }
};

export const downloadDischargePDF = async (req, res) => {
  try {
    const { dischargeId } = req.params;

    const discharge = await Discharge.findById(dischargeId)
      .populate("patient", "name age gender phone email address")
      .lean();

    if (!discharge) {
      return res.status(404).json({ message: "Discharge record not found" });
    }

    const doc = new PDFDocument({
      margin: 60,
      size: "A4",
    });

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="discharge-summary-${discharge.patient.name.replace(
        /\s+/g,
        "-"
      )}-${new Date().toISOString().split("T")[0]}.pdf"`
    );

    doc.pipe(res);

    generateDischargePDF(doc, discharge);

    doc.end();
  } catch (error) {
    console.error("Error generating discharge PDF:", error);
    if (!res.headersSent) {
      res
        .status(500)
        .json({ message: "Error generating PDF", error: error.message });
    }
  }
};

// Helper function to generate PDF content
const generateDischargePDF = (doc, discharge) => {
  const patient = discharge.patient;
  const margin = 60;
  const pageWidth = doc.page.width - margin * 2;
  const labelWidth = 140;
  const valueX = margin + labelWidth + 20;


  let currentY = margin + 40;

  doc
    .fontSize(26)
    .font("Helvetica-Bold")
    .fillColor("#2c3e50")
    .text("DISCHARGE SUMMARY", margin, currentY, {
      align: "center",
      width: pageWidth,
    });

  currentY += 40;

  doc
    .strokeColor("#3498db")
    .lineWidth(3)
    .moveTo(margin, currentY)
    .lineTo(margin + pageWidth, currentY)
    .stroke();

  currentY += 30;

  currentY = addSection(
    doc,
    "PATIENT INFORMATION",
    currentY,
    margin,
    pageWidth
  );

  currentY = addKeyValueRow(
    doc,
    "Patient Name",
    patient.name || "N/A",
    currentY,
    margin,
    labelWidth,
    valueX
  );
  currentY = addKeyValueRow(
    doc,
    "Age",
    patient.age ? `${patient.age} years` : "N/A",
    currentY,
    margin,
    labelWidth,
    valueX
  );
  currentY = addKeyValueRow(
    doc,
    "Gender",
    patient.gender || "N/A",
    currentY,
    margin,
    labelWidth,
    valueX
  );
  currentY = addKeyValueRow(
    doc,
    "Phone",
    patient.phone || "N/A",
    currentY,
    margin,
    labelWidth,
    valueX
  );
  currentY = addKeyValueRow(
    doc,
    "Email",
    patient.email || "N/A",
    currentY,
    margin,
    labelWidth,
    valueX
  );
  currentY = addKeyValueRow(
    doc,
    "Address",
    patient.address || "N/A",
    currentY,
    margin,
    labelWidth,
    valueX,
    true
  );

  currentY += 25;

  currentY = addSection(doc, "ADMISSION DETAILS", currentY, margin, pageWidth);

  currentY = addKeyValueRow(
    doc,
    "Admission Date",
    formatDate(discharge.admissionDate),
    currentY,
    margin,
    labelWidth,
    valueX
  );

  if (discharge.onAdmissionNotes) {
    currentY = addKeyValueRow(
      doc,
      "Clinical Notes",
      discharge.onAdmissionNotes,
      currentY,
      margin,
      labelWidth,
      valueX,
      true
    );
  }

  currentY += 25;

  currentY = addSection(doc, "DISCHARGE DETAILS", currentY, margin, pageWidth);

  currentY = addKeyValueRow(
    doc,
    "Discharge Date",
    formatDate(discharge.dischargeDate),
    currentY,
    margin,
    labelWidth,
    valueX
  );

  if (discharge.onDischargeNotes) {
    currentY = addKeyValueRow(
      doc,
      "Clinical Notes",
      discharge.onDischargeNotes,
      currentY,
      margin,
      labelWidth,
      valueX,
      true
    );
  }

  currentY += 25;

  if (discharge.diagnosis) {
    currentY = addSection(doc, "DIAGNOSIS", currentY, margin, pageWidth);

    doc
      .fontSize(11)
      .font("Helvetica")
      .fillColor("#2c3e50")
      .text(discharge.diagnosis, margin, currentY, {
        width: pageWidth,
        lineGap: 3,
      });

    currentY = doc.y + 25;
  }

  if (discharge.followUpDay || discharge.followUpTime) {
    currentY = addSection(
      doc,
      "FOLLOW-UP APPOINTMENT",
      currentY,
      margin,
      pageWidth
    );

    currentY = addKeyValueRow(
      doc,
      "Day",
      discharge.followUpDay || "N/A",
      currentY,
      margin,
      labelWidth,
      valueX
    );
    currentY = addKeyValueRow(
      doc,
      "Time",
      discharge.followUpTime || "N/A",
      currentY,
      margin,
      labelWidth,
      valueX
    );

    currentY += 25;
  }

  const footerY = doc.page.height - 80;

  doc
    .strokeColor("#bdc3c7")
    .lineWidth(1)
    .moveTo(margin, footerY - 20)
    .lineTo(margin + pageWidth, footerY - 20)
    .stroke();

  doc
    .fontSize(9)
    .font("Helvetica")
    .fillColor("#7f8c8d")
    .text(
      `Generated on: ${new Date().toLocaleString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })}`,
      margin,
      footerY,
      {
        align: "center",
        width: pageWidth,
      }
    );
};

const addSection = (doc, title, currentY, margin, pageWidth) => {
  if (currentY > doc.page.height - 150) {
    doc.addPage();
    currentY = 60;
  }

  doc
    .fontSize(14)
    .font("Helvetica-Bold")
    .fillColor("#34495e")
    .text(title, margin, currentY);

  currentY += 20;

  doc
    .strokeColor("#ecf0f1")
    .lineWidth(1)
    .moveTo(margin, currentY)
    .lineTo(margin + pageWidth, currentY)
    .stroke();

  return currentY + 15;
};

const addKeyValueRow = (
  doc,
  key,
  value,
  currentY,
  margin,
  labelWidth,
  valueX,
  isMultiline = false
) => {
  if (currentY > doc.page.height - 100) {
    doc.addPage();
    currentY = 60;
  }

  doc
    .fontSize(10)
    .font("Helvetica-Bold")
    .fillColor("#34495e")
    .text(`${key}:`, margin, currentY, {
      width: labelWidth,
      align: "left",
    });

  doc.fontSize(10).font("Helvetica").fillColor("#2c3e50");

  if (isMultiline) {
    const valueHeight = doc.heightOfString(value, {
      width: doc.page.width - valueX - margin,
      lineGap: 2,
    });

    doc.text(value, valueX, currentY, {
      width: doc.page.width - valueX - margin,
      lineGap: 2,
    });

    return currentY + Math.max(valueHeight, 12) + 8;
  } else {
    doc.text(value, valueX, currentY);
    return currentY + 18;
  }
};

const formatDate = (date) => {
  if (!date) return "N/A";

  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};
