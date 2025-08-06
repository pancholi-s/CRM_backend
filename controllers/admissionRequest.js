import PDFDocument from 'pdfkit';
import bcrypt from 'bcryptjs';
import mongoose from 'mongoose';
import { updateBillAfterAction } from '../middleware/billingMiddleware.js'; // Import the billing middleware function

import AdmissionRequest from '../models/admissionReqModel.js';
import Bed from '../models/bedModel.js';
import Room from '../models/roomModel.js';
import Patient from '../models/patientModel.js';
import Consultation from '../models/consultationModel.js';
import Discharge from '../models/DischargeModel.js';

export const createAdmissionRequest = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context found." });
    }

    const { patId, doctor, sendTo, admissionDetails } = req.body;
    const createdBy = req.user._id;

    let patient;

    // Step 1: Try finding patient by patId (optional path)
    if (patId) {
      patient = await Patient.findOne({ patId, hospital: hospitalId });
    }

    // Step 2: Validate room
    const room = await Room.findOne({ roomID: admissionDetails.room, hospital: hospitalId });
    if (!room) {
      return res.status(404).json({ message: "Room not found with given roomID." });
    }

    // Step 3: Validate bed
    const bed = await Bed.findOne({
      bedNumber: admissionDetails.bed,
      hospital: hospitalId,
      room: room._id,
      status: 'Available'
    });
    if (!bed) {
      return res.status(409).json({ message: "Bed not available. Already reserved or occupied." });
    }

    // Step 4: If patient doesn't exist, create new (only after bed is valid)
    if (!patient) {
      const { name, mobileNumber, email } = req.body;
      if (!name || !mobileNumber || !email) {
        return res.status(400).json({ message: "Missing patient registration details." });
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
      });

      await patient.save();
      console.log(`✅ New patient registered: ${patient.patId}`);
    }

    // Step 5: Mark bed as Reserved
    bed.status = 'Reserved';
    await bed.save();

    // Step 6: Prepare admissionDetails
    const admissionData = {
      ...admissionDetails,
      room: room._id,
      bed: bed._id,
      date: admissionDetails.date || admissionDetails.admissionDate
    };
    delete admissionData.admissionDate;

    // Step 7: Create admission request
    const request = await AdmissionRequest.create({
      patient: patient._id,
      hospital: hospitalId,
      doctor,
      createdBy,
      sendTo,
      admissionDetails: admissionData
    });

    res.status(201).json({
      message: "Admission request created successfully",
      request,
      patient: {
        name: patient.name,
        patId: patient.patId
      }
    });

  } catch (error) {
    console.error("❌ Create Admission Request Error:", error);
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
      return res.status(404).json({ message: 'Admission request not found.' });
    }

    if (
      (role === 'doctor' && ['Doctor', 'Both'].includes(admissionRequest.sendTo)) ||
      (role === 'hospitalAdmin' && ['Admin', 'Both'].includes(admissionRequest.sendTo)) // NOTE: sendTo uses "Admin"
    ) {
      // Update approval object correctly
      if (role === 'doctor') {
        admissionRequest.approval.doctor = {
          approved: true,
          signature,
          approvedAt: new Date()
        };
      }

      if (role === 'hospitalAdmin') {
        admissionRequest.approval.admin = {
          approved: true,
          signature,
          approvedAt: new Date()
        };
      }

      // Check if status should be marked as Approved
      const isApproved =
        (admissionRequest.sendTo === 'Both' &&
          admissionRequest.approval.doctor?.approved &&
          admissionRequest.approval.admin?.approved) ||
        (admissionRequest.sendTo === 'Doctor' && admissionRequest.approval.doctor?.approved) ||
        (admissionRequest.sendTo === 'Admin' && admissionRequest.approval.admin?.approved);

      if (isApproved) {
        admissionRequest.status = 'Approved';
      }

      await admissionRequest.save();

      return res.status(200).json({
        message: `Admission request ${role} approval successful.`,
        status: admissionRequest.status,
        approval: admissionRequest.approval,
      });
    } else {
      return res.status(403).json({ message: 'Not authorized to approve this request.' });
    }
  } catch (error) {
    console.error('Error approving admission request:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};



export const admitPatient = async (req, res) => {
  const session = await AdmissionRequest.startSession();
  session.startTransaction();

  try {
    const { requestId } = req.params;

    const admissionRequest = await AdmissionRequest.findById(requestId)
      .populate('patient')
      .populate('admissionDetails.bed')
      .populate('admissionDetails.room')
      .session(session);

    if (!admissionRequest) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Admission request not found.' });
    }

    if (admissionRequest.status !== 'Approved') {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Admission request is not yet approved.' });
    }

    const roomId = admissionRequest.admissionDetails.room?._id || admissionRequest.admissionDetails.room;
    const bedId = admissionRequest.admissionDetails.bed?._id || admissionRequest.admissionDetails.bed;

    if (!roomId || !bedId) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Room or bed reference missing in admission details.' });
    }

    const room = await Room.findById(roomId).session(session);
    const bed = await Bed.findById(bedId).session(session);

    if (!room) {
      await session.abortTransaction();
      return res.status(404).json({ message: 'Room not found.' });
    }

    if (!bed || !['Available', 'Reserved'].includes(bed.status)) {
      await session.abortTransaction();
      return res.status(400).json({ message: 'Bed is not available or reserved.' });
    }

    // ✅ Update patient admission status
    const updatedPatient = await Patient.findOneAndUpdate(
      { _id: admissionRequest.patient._id },
      { admissionStatus: 'Admitted' },
      { session, new: true }
    );

    if (!updatedPatient) {
      await session.abortTransaction();
      return res.status(500).json({ message: 'Failed to update patient admission status.' });
    }

    // ✅ Assign bed to patient
    bed.status = 'Occupied';
    bed.assignedPatient = admissionRequest.patient._id;
    bed.assignedDate = new Date();
    await bed.save({ session });

    // ✅ Update room bed availability
    await room.updateAvailableBeds();

    // ✅ Finalize admission request
    admissionRequest.status = 'Admitted';
    await admissionRequest.save({ session });

    await session.commitTransaction();

    res.status(200).json({
      message: 'Patient successfully admitted.',
      admissionRequestId: admissionRequest._id,
      updatedPatient: {
        id: updatedPatient._id,
        name: updatedPatient.name,
        admissionStatus: updatedPatient.admissionStatus,
      }
    });

  } catch (error) {
    await session.abortTransaction();
    console.error('Error admitting patient:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
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
    const filteredRequests = requests.filter(r => r.patient !== null);

    res.status(200).json({
      message: "Admission requests fetched successfully.",
      count: filteredRequests.length,
      requests: filteredRequests,
    });
  } catch (error) {
    console.error("Error fetching admission requests:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getApprovedAdmissions = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) return res.status(403).json({ message: "No hospital context found." });

    const approvedRequests = await AdmissionRequest.find({
      hospital: hospitalId,
      status: 'Approved',
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
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

export const getAdmittedPatients = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context found." });
    }

    const patientMap = {};

    // 1. Get all admitted patients, including healthStatus
    const admitted = await Patient.find({
      hospital: hospitalId,
      admissionStatus: "Admitted"
    }).select("name age gender contact phone admissionStatus healthStatus");

    // 2. Get their IDs
    const admittedPatientIds = admitted.map(p => p._id);

    // 3. Fetch related admission requests
    const admissionRequests = await AdmissionRequest.find({
      patient: { $in: admittedPatientIds },
      status: "Admitted"
    })
    .sort({ createdAt: -1 }) // get the latest
    .select("patient admissionDetails.medicalNote admissionDetails.date")
    .lean();

    // 4. Create map for admissionDetails
    const admissionDataMap = {};
    admissionRequests.forEach(req => {
      admissionDataMap[req.patient.toString()] = {
        medicalNote: req.admissionDetails?.medicalNote || null,
        date: req.admissionDetails?.date || null
      };
    });

    // 5. Construct admitted map with healthStatus included
    admitted.forEach(p => {
      const id = p._id.toString();

      patientMap[id] = {
        ...p.toObject(),
        ...admissionDataMap[id],  // adds medicalNote and date
        type: "admitted"
      };
    });

    // 6. Follow-up consultations
    const followUpConsultations = await Consultation.find({
      followUpRequired: true
    }).select("patient");

    const followUpPatientIds = [...new Set(
      followUpConsultations.map(c => c.patient.toString())
    )];

    const followUpPatients = await Patient.find({
      hospital: hospitalId,
      _id: { $in: followUpPatientIds }
    }).select("name age gender contact phone admissionStatus healthStatus");

    followUpPatients.forEach(p => {
      const id = p._id.toString();
      if (patientMap[id]) {
        patientMap[id].type += "+followup";
      } else {
        patientMap[id] = { ...p.toObject(), type: "followup" };
      }
    });

    // 7. Remove critical patients and map to patientMap
    const finalPatients = Object.values(patientMap);

    // 8. Adjust type sequence to always maintain: [admitted+followup], [followup], [admitted]
    finalPatients.forEach(p => {
      const types = p.type.split("+").sort((a, b) => {
        const order = ["admitted", "followup"];
        return order.indexOf(a) - order.indexOf(b); // Ensure fixed order
      });
      p.type = types.join("+");
      // Remove healthStatus from the response data (if needed)
      // delete p.healthStatus;  // If you still want to remove healthStatus, uncomment this line
    });

        // 9. Fetch the latest caseId from consultations
    for (let patient of finalPatients) {
      const latestConsultation = await Consultation.findOne({
        patient: patient._id,
      }).sort({ date: -1 }).select('caseId');  // Get the latest consultation's caseId

      if (latestConsultation) {
        patient.latestCaseId = latestConsultation.caseId;  // Add the latest caseId
      }
    }
    

    res.status(200).json({
      message: "Admitted, follow-up, and critical patients fetched successfully.",
      count: finalPatients.length,
      patients: finalPatients
    });
  } catch (error) {
    console.error("Error fetching tracked patients:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }

  
};


export const dischargePatient = async (req, res) => {
  const session = await mongoose.startSession();  // Start a session for the current request
  session.startTransaction();  // Start the transaction

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
      followUpTime
    } = req.body;

    const patient = await Patient.findById(patientId);
    if (!patient) return res.status(404).json({ message: 'Patient not found' });

    // Save discharge summary
    const discharge = new Discharge({
      patient: patientId,
      caseId,
      admissionDate,
      dischargeDate,
      onAdmissionNotes,
      onDischargeNotes,
      diagnosis,
      followUpDay,
      followUpTime
    });
    await discharge.save();

    // Dereference bed
    const bed = await Bed.findOne({ assignedPatient: patientId }).session(session);
    if (bed) {
      bed.status = 'Available';
      bed.assignedPatient = null;
      bed.dischargeDate = dischargeDate;
      await bed.save({ session });
    }

    // Update patient status
    patient.admissionStatus = 'Not Admitted';
    await patient.save({ session });

    // Update admission request
    const admissionRequest = await AdmissionRequest.findOne({
      patient: patientId,
      status: 'Admitted'
    });

    if (admissionRequest) {
      admissionRequest.status = 'discharged';
      await admissionRequest.save({ session });
    }

    // ---- Add Bed Charges Logic Here ----
    const bedChargeRate = bed?.charges?.dailyRate || 0;  // If bed has a daily rate, use it
    const assignedDate = bed?.assignedDate ? new Date(bed?.assignedDate) : null;
    const dischargeDateObj = dischargeDate ? new Date(dischargeDate) : new Date();

    // Ensure both dates are valid Date objects
    if (assignedDate && dischargeDateObj) {
      // Calculate the number of days the bed was occupied
      const timeDiff = dischargeDateObj - assignedDate;
      const daysOccupied = Math.floor(timeDiff / (1000 * 3600 * 24));  // Convert milliseconds to days

      // Avoid negative days (in case of erroneous data)
      if (daysOccupied < 0) {
        throw new Error("Discharge date cannot be earlier than assigned date.");
      }

      // Calculate total bed charges for the occupied days
      const bedCharges = daysOccupied * bedChargeRate;

      // Prepare the bed charge details (without referencing service)
      const bedChargeDetails = {
        service: null,  // No service ID for room & bed, so we keep it null
        category: bed?.room?.name || 'Unknown Room',
        quantity: daysOccupied,  // Quantity = number of days occupied
        rate: bedChargeRate,  // Daily rate from the bed model
        details: {
          bedType: bed?.bedType || "Not Specified",
          features: bed?.features || "No features specified",
          bedNumber: bed?.bedNumber || "Not Specified",
          daysOccupied,  // Added for reference
          totalCharge: bedCharges,  // Total charge for the bed occupancy
        }
      };

      // Call the centralized function to update or create the bill (only bed charges)
      await updateBillAfterAction(caseId, session, bedChargeDetails);  // Pass the bed charge details to update bill
    } else {
      throw new Error("Assigned date or discharge date is missing.");
    }

    res.status(200).json({ message: 'Patient discharged successfully', discharge });
    
  } catch (error) {
    console.error('Error discharging patient:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  } finally {
    // Always ensure the session is closed
    if (session) {
      session.endSession();
    }
  }
};



export const downloadDischargePDF = async (req, res) => {
  try {
    const { dischargeId } = req.params;

    const discharge = await Discharge.findById(dischargeId)
      .populate('patient', 'name age gender phone email address')
      .lean();

    if (!discharge) {
      return res.status(404).json({ message: 'Discharge record not found' });
    }

    const doc = new PDFDocument({ 
      margin: 60,
      size: 'A4'
    });
    
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="discharge-summary-${discharge.patient.name.replace(/\s+/g, '-')}-${new Date().toISOString().split('T')[0]}.pdf"`);
    
    doc.pipe(res);

    generateDischargePDF(doc, discharge);
    
    doc.end();

  } catch (error) {
    console.error('Error generating discharge PDF:', error);
    if (!res.headersSent) {
      res.status(500).json({ message: 'Error generating PDF', error: error.message });
    }
  }
};

// Helper function to generate PDF content
const generateDischargePDF = (doc, discharge) => {
  const patient = discharge.patient;
  const margin = 60;
  const pageWidth = doc.page.width - (margin * 2);
  const labelWidth = 140;
  const valueX = margin + labelWidth + 20;
  
  let currentY = margin + 40;

  doc.fontSize(26)
     .font('Helvetica-Bold')
     .fillColor('#2c3e50')
     .text('DISCHARGE SUMMARY', margin, currentY, { 
       align: 'center',
       width: pageWidth 
     });
  
  currentY += 40;
  
  doc.strokeColor('#3498db')
     .lineWidth(3)
     .moveTo(margin, currentY)
     .lineTo(margin + pageWidth, currentY)
     .stroke();
  
  currentY += 30;


  currentY = addSection(doc, 'PATIENT INFORMATION', currentY, margin, pageWidth);
  
  currentY = addKeyValueRow(doc, 'Patient Name', patient.name || 'N/A', currentY, margin, labelWidth, valueX);
  currentY = addKeyValueRow(doc, 'Age', patient.age ? `${patient.age} years` : 'N/A', currentY, margin, labelWidth, valueX);
  currentY = addKeyValueRow(doc, 'Gender', patient.gender || 'N/A', currentY, margin, labelWidth, valueX);
  currentY = addKeyValueRow(doc, 'Phone', patient.phone || 'N/A', currentY, margin, labelWidth, valueX);
  currentY = addKeyValueRow(doc, 'Email', patient.email || 'N/A', currentY, margin, labelWidth, valueX);
  currentY = addKeyValueRow(doc, 'Address', patient.address || 'N/A', currentY, margin, labelWidth, valueX, true);
  
  currentY += 25;

  currentY = addSection(doc, 'ADMISSION DETAILS', currentY, margin, pageWidth);
  
  currentY = addKeyValueRow(doc, 'Admission Date', formatDate(discharge.admissionDate), currentY, margin, labelWidth, valueX);
  
  if (discharge.onAdmissionNotes) {
    currentY = addKeyValueRow(doc, 'Clinical Notes', discharge.onAdmissionNotes, currentY, margin, labelWidth, valueX, true);
  }
  
  currentY += 25;

  currentY = addSection(doc, 'DISCHARGE DETAILS', currentY, margin, pageWidth);
  
  currentY = addKeyValueRow(doc, 'Discharge Date', formatDate(discharge.dischargeDate), currentY, margin, labelWidth, valueX);
  
  if (discharge.onDischargeNotes) {
    currentY = addKeyValueRow(doc, 'Clinical Notes', discharge.onDischargeNotes, currentY, margin, labelWidth, valueX, true);
  }
  
  currentY += 25;

  if (discharge.diagnosis) {
    currentY = addSection(doc, 'DIAGNOSIS', currentY, margin, pageWidth);
    
    doc.fontSize(11)
       .font('Helvetica')
       .fillColor('#2c3e50')
       .text(discharge.diagnosis, margin, currentY, { 
         width: pageWidth,
         lineGap: 3
       });
    
    currentY = doc.y + 25;
  }

  if (discharge.followUpDay || discharge.followUpTime) {
    currentY = addSection(doc, 'FOLLOW-UP APPOINTMENT', currentY, margin, pageWidth);
    
    currentY = addKeyValueRow(doc, 'Day', discharge.followUpDay || 'N/A', currentY, margin, labelWidth, valueX);
    currentY = addKeyValueRow(doc, 'Time', discharge.followUpTime || 'N/A', currentY, margin, labelWidth, valueX);
    
    currentY += 25;
  }

  const footerY = doc.page.height - 80;
  
  doc.strokeColor('#bdc3c7')
     .lineWidth(1)
     .moveTo(margin, footerY - 20)
     .lineTo(margin + pageWidth, footerY - 20)
     .stroke();

  doc.fontSize(9)
     .font('Helvetica')
     .fillColor('#7f8c8d')
     .text(`Generated on: ${new Date().toLocaleString('en-US', {
       year: 'numeric',
       month: 'long', 
       day: 'numeric',
       hour: '2-digit',
       minute: '2-digit'
     })}`, margin, footerY, { 
       align: 'center',
       width: pageWidth 
     });
};

const addSection = (doc, title, currentY, margin, pageWidth) => {
  if (currentY > doc.page.height - 150) {
    doc.addPage();
    currentY = 60;
  }

  doc.fontSize(14)
     .font('Helvetica-Bold')
     .fillColor('#34495e')
     .text(title, margin, currentY);
  
  currentY += 20;
  
  doc.strokeColor('#ecf0f1')
     .lineWidth(1)
     .moveTo(margin, currentY)
     .lineTo(margin + pageWidth, currentY)
     .stroke();
  
  return currentY + 15;
};

const addKeyValueRow = (doc, key, value, currentY, margin, labelWidth, valueX, isMultiline = false) => {
  if (currentY > doc.page.height - 100) {
    doc.addPage();
    currentY = 60;
  }

  doc.fontSize(10)
     .font('Helvetica-Bold')
     .fillColor('#34495e')
     .text(`${key}:`, margin, currentY, { 
       width: labelWidth,
       align: 'left'
     });

  doc.fontSize(10)
     .font('Helvetica')
     .fillColor('#2c3e50');

  if (isMultiline) {
    const valueHeight = doc.heightOfString(value, { 
      width: doc.page.width - valueX - margin,
      lineGap: 2
    });
    
    doc.text(value, valueX, currentY, { 
      width: doc.page.width - valueX - margin,
      lineGap: 2
    });
    
    return currentY + Math.max(valueHeight, 12) + 8;
  } else {
    doc.text(value, valueX, currentY);
    return currentY + 18;
  }
};

const formatDate = (date) => {
  if (!date) return 'N/A';
  
  return new Date(date).toLocaleDateString('en-US', {
    year: 'numeric', 
    month: 'long', 
    day: 'numeric'
  });
};