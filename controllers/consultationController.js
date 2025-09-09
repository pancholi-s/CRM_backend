import Consultation from '../models/consultationModel.js';
import Department from '../models/departmentModel.js';
import Hospital from '../models/hospitalModel.js';
import Appointment from '../models/appointmentModel.js';
import Patient from '../models/patientModel.js';
import ProgressPhase from '../models/ProgressPhase.js';
import ProgressLog from '../models/progressLog.js';
import Service from '../models/serviceModel.js';
import Doctor from '../models/doctorModel.js';

import { updateBillAfterAction } from '../middleware/billingMiddleware.js'; // Import the billing middleware function

export const submitConsultation = async (req, res) => {
  const session = await Consultation.startSession();  // Start a session for the current request
  session.startTransaction();  // Start the transaction

  try {
    const hospitalId = req.session.hospitalId;
    const {
      doctor,
      patient,
      appointment,
      department,
      consultationData,
      action,
      tab,
      referredToDoctor,
      referredToDepartment,
      referralReason,
      preferredDate,
      preferredTime,
      referralUrgency,
      referralTracking,
      primaryDiagnosis,
      externalFacility,
      newFacilityName,
      referredSpecialist,
      specialtyArea,
      supportingDocument,
      treatment,
      followUpRequired
    } = req.body;

    // Validate required fields
    if (!hospitalId) {
      return res.status(403).json({ message: "Access denied. No hospital context found." });
    }

    if (!doctor || !patient || !appointment || !department || !consultationData || !action) {
      return res.status(400).json({ message: "All required fields including action must be provided." });
    }

    const doctorDoc = await Doctor.findById(doctor).select('name').session(session);
    if (!doctorDoc) {
      throw new Error("Doctor not found");
    }

    // Now the doctor name can be accessed as doctorDoc.name
    const doctorName = doctorDoc.name;

    const validActions = ["complete", "refer", "schedule"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: "Invalid action type." });
    }

    // Fetch hospital and department
    const hospital = await Hospital.findById(hospitalId).session(session);
    if (!hospital) {
      throw new Error("Hospital not found.");
    }

    const departmentExists = await Department.findOne({
      _id: department,
      hospital: hospitalId,
    }).session(session);

    if (!departmentExists) {
      throw new Error("Department not found in this hospital.");
    }

    // Fetch appointment and patient
    const appointmentDoc = await Appointment.findById(appointment).session(session);
    if (!appointmentDoc) {
      throw new Error("Appointment not found.");
    }

    const patientDoc = await Patient.findOne({ _id: patient, hospital: hospitalId }).session(session);
    if (!patientDoc) {
      throw new Error("Patient not found.");
    }

    const caseId = appointmentDoc.caseId;

    // Prepare consultation payload
    const consultationPayload = {
      doctor,
      doctorName, // Pass doctorName here
      patient,
      appointment,
      department,
      consultationData,
      status: "completed",
      followUpRequired: false,
      caseId
    };

    // Handle action types (complete, refer, schedule)
    if (action === "complete") {
      consultationPayload.status = "completed";
      consultationPayload.followUpRequired = followUpRequired === true;
    }

    if (action === "refer") {
      consultationPayload.tab = tab;
      consultationPayload.primaryDiagnosis = primaryDiagnosis;
      consultationPayload.referralUrgency = referralUrgency;

      if (tab === "internal") {
        consultationPayload.status = "referred";
        consultationPayload.followUpRequired = true;
        consultationPayload.referredToDoctor = referredToDoctor;
        consultationPayload.referredToDepartment = referredToDepartment;
        consultationPayload.referralReason = referralReason;
        consultationPayload.preferredDate = preferredDate;
        consultationPayload.preferredTime = preferredTime;
        consultationPayload.referralTracking = referralTracking;
      }

      if (tab === "external") {
        consultationPayload.status = "completed";
        consultationPayload.followUpRequired = false;
        consultationPayload.externalFacility = externalFacility;
        if (newFacilityName) {
          consultationPayload.newFacilityName = newFacilityName;
        }
        consultationPayload.referredSpecialist = referredSpecialist;
        consultationPayload.specialtyArea = specialtyArea;
        consultationPayload.supportingDocument = supportingDocument;
      }
    }

    if (action === "schedule") {
      consultationPayload.status = "scheduled";
      consultationPayload.followUpRequired = true;
      consultationPayload.treatment = treatment;

      const admissionRec = treatment?.admissionRecommendation === true ? "Yes" : "No";
      await Patient.findByIdAndUpdate(patient, { admissionRecommendation: admissionRec }, { session });
    }

    // Create the new consultation
    const newConsultation = await Consultation.create([consultationPayload], { session });

    // Update the appointment status
    await Appointment.findByIdAndUpdate(appointment, { status: "completed" }, { session });

    // Step 1: Fetch Consultation Service from Service collection
    const consultationService = await Service.findOne({ name: "Consultation", hospital: hospitalId }).session(session);
    console.log("Fetched Consultation Service:", consultationService);  // Log the fetched consultation service

    // Step 2: Find the rate for the Consultation service from the categories array
    let consultationRate = 0;  // Default to 0
    if (consultationService) {
      // Find the category with subCategoryName "Doctor Consultation"
      const consultationCategory = consultationService.categories.find(
        category => category.subCategoryName === "Doctor Consultation"
      );
      if (consultationCategory) {
        consultationRate = consultationCategory.rate; // Use the rate from the category
      }
    }

    console.log("Fetched Consultation Rate:", consultationRate);  // Log the fetched rate

    // Step 3: Prepare Consultation Charges with details
    const consultationCharge = {
      service: consultationService ? consultationService._id : null, // Set service ID or null if missing
      category: "Doctor Consultation",
      quantity: 1,
      rate: consultationRate,  // Use the fetched rate
      details: {
        consultationData: consultationData,
        doctorName: doctorName, // Add doctor's name here in details
        consultationDate: new Date(),  // Add the current date or the consultation date here
      },  // Pass the consultationData details here
    };

    console.log("Consultation Charge:", consultationCharge);  // Log the consultation charge before passing to `updateBillAfterAction`

    // Step 4: Call centralized updateBillAfterAction with the session
    await updateBillAfterAction(caseId, session, consultationCharge);  // Pass the `consultationCharge` to be included in services

    // Send Response
    res.status(200).json({
      message: `Consultation successfully ${action === "complete" ? "completed" : action}.`,
      data: newConsultation
    });

  } catch (error) {
    console.error("Error updating consultation action:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  } finally {
    // Always ensure the session is closed
    if (session) {
      session.endSession();
    }
  }
};

export const getConsultationByAppointment = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    const { appointmentId } = req.params;

    if (!hospitalId) {
      return res
        .status(400)
        .json({ message: "Hospital context not found in session." });
    }

    const consultation = await Consultation.findOne({
      appointment: appointmentId,
    })
      .populate("doctor", "name")
      .populate("patient", "name")
      .populate("department", "name");

    if (!consultation) {
      return res
        .status(404)
        .json({ message: "Consultation not found for this appointment." });
    }

    res.status(200).json({
      message: "Consultation retrieved successfully.",
      consultation,
    });
  } catch (error) {
    console.error("Error fetching consultation:", error);
    res.status(500).json({ message: "Error fetching consultation." });
  }
};

export const getPatientConsultationHistory = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    const { patientId } = req.params;
    const { departmentId } = req.query; // Optional filter for department

    if (!hospitalId) {
      return res
        .status(400)
        .json({ message: "Hospital context not found in session." });
    }

    const filter = { patient: patientId };
    if (departmentId) {
      filter.department = departmentId;
    }

    const consultations = await Consultation.find(filter)
      .select("consultationData date doctor department") // All sections
      .populate("department", "name")
      .populate("doctor", "name");

    if (!consultations.length) {
      return res
        .status(404)
        .json({ message: "No consultations found for this patient." });
    }

    const history = consultations.map((cons) => ({
      department: cons.department.name,
      doctor: cons.doctor.name,
      date: cons.date,
      consultationData: cons.consultationData,
    }));

    res.status(200).json({
      message: "Full consultation history retrieved successfully.",
      count: history.length,
      history,
    });
  } catch (error) {
    console.error("Error fetching consultation history:", error);
    res.status(500).json({ message: "Error fetching consultation history." });
  }
};

export const getMostCommonDiagnoses = async (req, res) => {
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: "No hospital context found." });
  }

  const thisYearStart = new Date(new Date().getFullYear(), 0, 1);

  try {
    const result = await Consultation.aggregate([
      {
        $match: {
          department: { $exists: true },
          date: { $gte: thisYearStart },
          "consultationData.diagnosis": { $exists: true, $ne: null },
        },
        // $match: {
        //   department: { $exists: true },
        //   date: { $gte: thisYearStart },
        //   "consultationData.referralTracking.primaryDiagnosis": { $exists: true, $ne: null },
        // },
      },
      {
        $facet: {
          topDiagnoses: [
            {
              $group: {
                _id: "$consultationData.diagnosis",
                count: { $sum: 1 },
              },
              // $group: {
              //   _id: "$consultationData.referralTracking.primaryDiagnosis",
              //   count: { $sum: 1 }
              // },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
          totalCount: [
            {
              $group: {
                _id: "$consultationData.diagnosis",
              },
              // $group: {
              //   _id: "$consultationData.referralTracking.primaryDiagnosis",
              // },
            },
            {
              $count: "total",
            },
          ],
        },
      },
    ]);

    const topDiagnoses = result[0].topDiagnoses.map((item) => ({
      diagnosis: item._id,
      count: item.count,
    }));

    const total = result[0].totalCount[0]?.total || 0;

    res.status(200).json({
      success: true,
      totalDiagnoses: total,
      data: topDiagnoses,
    });
  } catch (error) {
    res.status(500).json({ message: "Server error.", error });
  }
};

export const getProgressTracker = async (req, res) => {
  try {
    const { patientId, caseId } = req.params;

    // 1️⃣ Find the patient
    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    console.log("Patient ID:", patientId);
    console.log("Case ID:", caseId);

    const progress = [];

    // 2️⃣ Fetch consultations (appointment-created cases may have these)
    let consultations = await Consultation.find({ patient: patientId, caseId })
      .populate('doctor', 'name')
      .populate('department', 'name')
      .populate('appointment', 'caseId')
      .sort({ date: 1 });

    if (!consultations.length) {
      console.warn(`⚠ No consultations found for caseId: ${caseId}. Proceeding with phases only.`);
    }

    // Process consultations
    if (consultations.length) {
      const group = consultations;
      group.forEach((c, index) => {
        const isFirst = index === 0;
        const isLast = index === group.length - 1;

        let phase = isFirst ? "initial" : "middle";
        let status = "ongoing";

        // Handle initial phase
        if (isFirst && group.length === 1) {
          status = c.status === "completed" ? "completed" : "ongoing"; // Initial consultation should be marked as completed if done
        } else if (isLast) {
          status = c.status === "completed" ? "completed" : "ongoing";
        } else {
          status = "completed";
        }

        // If this is the final consultation (external referral), mark as final
        if (c.isFinal) {
          phase = "final";
          status = "completed";
        }

        progress.push({
          type: "consultation",
          phase,
          title: phase === "initial" ? "initial" : undefined,
          date: c.date,
          doctor: c.doctor,
          department: c.department,
          data: c.consultationData,
          status,
          caseId,
          sourceId: c._id,
          sourceType: "consultation"
        });
      });
    }

    // 3️⃣ Fetch progress phases for that specific caseId
    const phases = await ProgressPhase.find({ caseId })
      .populate('assignedDoctor', 'name')
      .populate('consultation', 'title date')
      .sort({ date: 1 });

    if (!phases.length) {
      console.warn(`⚠ No phases found for caseId: ${caseId}. Proceeding with consultations only.`);
    }

    // Process phases
    // Process phases
    if (phases.length) {
      phases.forEach((p, index) => {
        if (!p.date) return;

        let status = 'ongoing';
        if (p.isFinal) {
          status = 'Final';
        } else if (p.isDone) {
          status = 'completed';
        }

        if (index === phases.length - 1 && p.title === 'initial') {
          status = 'completed';
        }

        progress.push({
          type: 'phase',
          id: p._id,
          date: p.date,
          doctor: p.assignedDoctor,
          title: p.title,
          status,
          caseId,
          data: p.data || null,        // ✅ Include phase data
          files: p.files || [],        // ✅ Include attached files if needed
          sourceId: p._id,
          sourceType: 'phase'
        });
      });
    }

    // Final sort by date (timestamp)
    progress.sort((a, b) => new Date(b.date) - new Date(a.date));

    // 4️⃣ Build log entries
    const logEntries = progress.map(item => ({
      caseId: item.caseId,
      sourceType: item.sourceType,
      sourceId: item.sourceId,
      phaseCategory: item.phase || (item.status === 'final' ? 'final' : item.status === 'completed' ? 'final' : 'ongoing'),
      status: item.status,
      doctor: item.doctor?._id || null,
      department: item.department?._id || null,
      date: item.date,
      title: item.title || null,
      consultationData: item.data || {}  // Ensure `data` is always returned, even if empty
    }));

    // 5️⃣ Insert or update ProgressLog (Error handling if this fails)
    try {
      const existingLog = await ProgressLog.findOne({
        patient: patientId,
        'logs.caseId': caseId,
        $or: [
          { 'logs.sourceId': { $ne: null } },
          { 'logs.sourceType': { $ne: null } }
        ]
      });

      if (!existingLog) {
        await ProgressLog.create({
          patient: patientId,
          date: new Date(),
          status: 'ongoing',
          logs: logEntries
        });
      } else {
        await ProgressLog.findOneAndUpdate(
          { patient: patientId, 'logs.caseId': caseId },
          {
            $addToSet: {
              'logs': { $each: logEntries }
            }
          },
          { new: true }
        );
      }
    } catch (logError) {
      console.error("Error updating ProgressLog:", logError);
      // Optionally log the error but continue the response
      // You can log it or handle it as per your use case
    }

    // 6️⃣ Send response with progress
    res.status(200).json({
      message: 'Progress tracker data fetched successfully.',
      progress
    });

  } catch (error) {
    console.error('Error fetching progress tracker:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};



export const getProgressPhaseCounts = async (req, res) => {
  try {
    const logs = await ProgressLog.find({});

    const counts = {
      initial: 0,
      ongoing: 0,
      final: 0,
    };

    for (const log of logs) {
      if (!log.logs || !Array.isArray(log.logs)) continue;

      for (const entry of log.logs) {
        const cat = entry.phaseCategory;
        if (counts[cat] !== undefined) {
          counts[cat]++;
        }
      }
    }

    res.status(200).json({
      message: "Overall progress phase counts fetched successfully.",
      counts
    });

  } catch (error) {
    console.error("Error fetching progress phase counts:", error);
    res.status(500).json({
      message: "Internal server error",
      error: error.message
    });
  }
};


export const addProgressPhase = async (req, res) => {
  try {
    const {
      caseId,
      patient,
      title,
      date, // user-provided date string like "2025-08-13"
      assignedDoctor,

      isFinalPhase,
      data // dynamic data field (with arrays of strings)
    } = req.body;

    if (!caseId || !patient || !title || !assignedDoctor) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    // 1. Block if final phase exists
    const finalExists = await ProgressPhase.exists({ caseId, isFinal: true });
    if (finalExists) {
      return res.status(400).json({ message: 'Cannot add more phases. Final phase already exists.' });
    }

    // 2. Close the latest item (phase or consultation)
    const lastPhase = await ProgressPhase.findOne({ caseId }).sort({ date: -1 });
    const lastConsultation = await Consultation.findOne({ caseId }).sort({ date: -1 });

    let latestItem = null;
    let latestType = null;

    if (lastPhase && lastConsultation) {
      if (new Date(lastPhase.date) > new Date(lastConsultation.date)) {
        latestItem = lastPhase;
        latestType = "phase";
      } else {
        latestItem = lastConsultation;
        latestType = "consultation";
      }
    } else if (lastPhase) {
      latestItem = lastPhase;
      latestType = "phase";
    } else if (lastConsultation) {
      latestItem = lastConsultation;
      latestType = "consultation";
    }

    if (latestItem) {
      if (latestType === "phase" && !latestItem.isDone) {
        latestItem.isDone = true;
        await latestItem.save();
      } else if (latestType === "consultation" && latestItem.status !== "completed") {
        latestItem.status = "completed";
        await latestItem.save();
      }
    }

    // 3. Merge user date with system time
    const now = new Date();
    const [year, month, day] = new Date(date).toISOString().split("T")[0].split("-");
    const finalDate = new Date(`${year}-${month}-${day}T${now.getHours().toString().padStart(2, "0")}:${now.getMinutes().toString().padStart(2, "0")}:${now.getSeconds().toString().padStart(2, "0")}Z`);

    // 4. Create new phase with dynamic 'data' field (arrays of strings)
    const newPhase = await ProgressPhase.create({
      caseId,
      patient,
      title: isFinalPhase ? 'final' : title,
      date: finalDate,
      assignedDoctor,
      data: data || {}, // Save dynamic data as arrays or strings
      isDone: false,
      isFinal: !!isFinalPhase
    });

    res.status(201).json({
      message: "Progress phase added successfully",
      phase: newPhase
    });

  } catch (error) {
    console.error("Error adding progress phase:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
};



export const updatePhase = async (req, res) => {
  const { sourceType, sourceId } = req.params; // sourceType: "phase" or "consultation"
  const updates = req.body;

  try {
    let updatedItem;

    if (sourceType === "phase") {
      // Find the existing phase by sourceId
      updatedItem = await ProgressPhase.findById(sourceId);
      if (!updatedItem) {
        return res.status(404).json({ message: "Progress phase not found" });
      }

      // Handle dynamic 'data' field update (Mixed type)
      if (updates.data) {
        updatedItem.data = { ...updatedItem.data, ...updates.data };  // Merge new data with existing data
      }

      // Convert isFinal / isDone to booleans if present
      if (typeof updates.isFinal !== "undefined") {
        updatedItem.isFinal = typeof updates.isFinal === "string"
          ? updates.isFinal.toLowerCase() === "yes"
          : !!updates.isFinal;
      }
      if (typeof updates.isDone !== "undefined") {
        updatedItem.isDone = updates.isDone === true || updates.isDone === "true";
      }

      // Update other fields
      if (updates.title !== undefined) updatedItem.title = updates.title;
      if (updates.description !== undefined) updatedItem.description = updates.description;
      if (updates.files !== undefined) updatedItem.files = updates.files;
      if (updates.assignedDoctor !== undefined) updatedItem.assignedDoctor = updates.assignedDoctor;
      if (updates.consultation !== undefined) updatedItem.consultation = updates.consultation;

      // Save the updated phase
      await updatedItem.save();
    } else if (sourceType === "consultation") {
      updatedItem = await Consultation.findById(sourceId);
      if (!updatedItem) {
        return res.status(404).json({ message: "Consultation not found" });
      }

      // Update only allowed fields for consultation
      const allowedFields = [
        "consultationData", "status", "followUpRequired", "referredToDoctor",
        "referredToDepartment", "referralReason", "preferredDate",
        "preferredTime", "treatment"
      ];

      allowedFields.forEach(field => {
        if (updates[field] !== undefined) {
          updatedItem[field] = updates[field];
        }
      });

      // Save the updated consultation
      await updatedItem.save();
    } else {
      return res.status(400).json({ message: "Invalid sourceType. Use 'phase' or 'consultation'" });
    }

    // Send the response with the updated phase or consultation
    res.status(200).json({
      message: `${sourceType} updated successfully`,
      data: updatedItem
    });

  } catch (error) {
    console.error(`Error updating ${req.params.sourceType}:`, error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};




export const updateConsultation = async (req, res) => {
  try {
    const { consultationId } = req.params;
    const {
      consultationData,
      status,
      followUpRequired,
      referredToDoctor,
      referredToDepartment,
      referralReason,
      preferredDate,
      preferredTime,
      treatment
    } = req.body;

    const updatedFields = {
      consultationData,
      status,
      followUpRequired,
      referredToDoctor,
      referredToDepartment,
      referralReason,
      preferredDate,
      preferredTime,
      treatment
    };

    // Remove undefined/null values
    Object.keys(updatedFields).forEach(key => {
      if (updatedFields[key] === undefined) delete updatedFields[key];
    });

    const updatedConsultation = await Consultation.findByIdAndUpdate(
      consultationId,
      { $set: updatedFields },
      { new: true }
    );

    if (!updatedConsultation) {
      return res.status(404).json({ message: "Consultation not found." });
    }

    res.status(200).json({
      message: "Consultation updated successfully.",
      consultation: updatedConsultation
    });
  } catch (error) {
    console.error("Error updating consultation:", error);
    res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
