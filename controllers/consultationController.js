import Consultation from '../models/consultationModel.js';
import Department from '../models/departmentModel.js';
import Hospital from '../models/hospitalModel.js';
import Appointment from '../models/appointmentModel.js';
import Patient from '../models/patientModel.js';
import ProgressPhase from '../models/ProgressPhase.js';

export const submitConsultation = async (req, res) => {
  const session = await Consultation.startSession();
  session.startTransaction();

  try {
    const hospitalId = req.session.hospitalId;
    const {
      doctor,
      patient,
      appointment,
      department,
      consultationData,
      action,
      tab, // renamed from referralType
      referredToDoctor,
      referredToDepartment,
      referralReason,
      preferredDate,
      preferredTime,
      referralUrgency, // added
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

    if (!hospitalId) {
      return res.status(403).json({ message: "Access denied. No hospital context found." });
    }

    if (!doctor || !patient || !appointment || !department || !consultationData || !action) {
      return res.status(400).json({ message: "All required fields including action must be provided." });
    }

    const validActions = ["complete", "refer", "schedule"];
    if (!validActions.includes(action)) {
      return res.status(400).json({ message: "Invalid action type." });
    }

    const hospital = await Hospital.findById(hospitalId).session(session);
    if (!hospital) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Hospital not found." });
    }

    const departmentExists = await Department.findOne({
      _id: department,
      hospital: hospitalId,
    }).session(session);

    if (!departmentExists) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Department not found in this hospital." });
    }

    const appointmentDoc = await Appointment.findById(appointment).session(session);
    if (!appointmentDoc) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Appointment not found." });
    }

    const caseId = appointmentDoc.caseId;

    const consultationPayload = {
      doctor,
      patient,
      appointment,
      department,
      consultationData,
      status: "completed",
      followUpRequired: false,
      caseId
    };

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
      await Patient.findByIdAndUpdate(
        patient,
        { admissionRecommendation: admissionRec },
        { session }
      );
    }

    const newConsultation = await Consultation.create([consultationPayload], { session });

    await Appointment.findByIdAndUpdate(
      appointment,
      { status: "completed" },
      { session }
    );

    await session.commitTransaction();
    session.endSession();

    res.status(201).json({
      message: "Consultation submitted successfully.",
      consultation: newConsultation[0],
    });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error submitting consultation:", error);
    res.status(500).json({
      message: "Error submitting consultation.",
      error: error.message,
    });
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
    const { patientId } = req.params;

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }

    // Fetch consultations
    let consultations = await Consultation.find({ patient: patientId })
      .populate('doctor', 'name')
      .populate('department', 'name')
      .populate('appointment', 'caseId')
      .sort({ date: 1 });

    if (!consultations.length) {
      return res.status(200).json({ message: 'No consultations found', progress: [] });
    }

    const progress = [];

    // Group consultations by caseId
    const grouped = {};
    consultations.forEach(c => {
      const caseId = c.appointment?.caseId;
      if (!caseId) return;

      if (!grouped[caseId]) grouped[caseId] = [];
      grouped[caseId].push(c);
    });

    // Process consultations
    for (const caseId in grouped) {
      const group = grouped[caseId];

      group.forEach((c, index) => {
        let phaseType = 'middle';
        const isFirst = index === 0;
        const isLast = index === group.length - 1;

        if (isFirst) {
          phaseType = 'initial';
        } else if (isLast && c.status === 'completed') {
          phaseType = 'final';
        }

        // Normalize consultation status
        const status = c.status === 'completed' ? 'completed' : 'ongoing';

        progress.push({
          type: 'consultation',
          phase: phaseType,
          date: c.date,
          doctor: c.doctor,
          department: c.department,
          data: c.consultationData,
          status,
          caseId
        });
      });
    }

    // Get all unique caseIds from consultations
    const caseIds = Object.keys(grouped);

    // Fetch progress phases
    const phases = await ProgressPhase.find({ caseId: { $in: caseIds } })
      .populate('assignedDoctor', 'name')
      .populate('consultation', 'title date')
      .sort({ date: 1 });

    // Group phases by caseId
    const phaseGrouped = {};
    phases.forEach(p => {
      if (!phaseGrouped[p.caseId]) phaseGrouped[p.caseId] = [];
      phaseGrouped[p.caseId].push(p);
    });

    // Append normalized phases to progress
    for (const caseId in phaseGrouped) {
      const casePhases = phaseGrouped[caseId];

      casePhases.forEach(p => {
        if (!p.date) return; // Skip entries with missing dates

        // Normalize status for phase
        let status = 'ongoing'; // default
        if (p.isFinal === true) {
          status = 'final';
        } else if (p.isDone === true) {
          status = 'completed';
        }

        progress.push({
          type: 'phase',
          id: p._id,
          date: p.date,
          doctor: p.assignedDoctor,
          title: p.title,
          data: {
            description: p.description,
            files: p.files,
          },
          status,
          caseId,
          consultationId: p.consultation?._id || null,
        });
      });
    }

    // Final sort by date
    progress.sort((a, b) => new Date(a.date) - new Date(b.date));

    res.status(200).json({
      message: 'Progress tracker data fetched successfully.',
      progress
    });

  } catch (error) {
    console.error('Error fetching progress tracker:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
  }
};



export const addProgressPhase = async (req, res) => {
  try {
    const {
      caseId,
      patient,
      title,
      date,
      assignedDoctor,
      description,
      files,
      isFinalPhase // <- boolean flag to mark final
    } = req.body;

    if (!caseId || !patient || !title || !assignedDoctor) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    // Step 1: Check if a "final" phase already exists for this caseId
    const finalExists = await ProgressPhase.exists({ caseId, title: "final" });
    if (finalExists) {
      return res.status(400).json({ message: 'Cannot add more phases. Final phase already exists.' });
    }

    // Step 2: Mark previous phase as completed
    const lastPhase = await ProgressPhase.findOne({ caseId }).sort({ date: -1 });
    if (lastPhase && !lastPhase.isCompleted) {
      lastPhase.isCompleted = true;
      await lastPhase.save();
    }

    // Step 3: Determine title
    const phaseTitle = isFinalPhase ? 'final' : title;

    // Step 4: Create new phase
    const newPhase = await ProgressPhase.create({
      caseId,
      patient,
      title: phaseTitle,
      date,
      assignedDoctor,
      isCompleted: false,
      description,
      files
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
  try {
    const { phaseId } = req.params;
    const updates = req.body;

    const phase = await ProgressPhase.findById(phaseId);
    if (!phase) {
      return res.status(404).json({ message: 'Progress phase not found' });
    }

    // Convert isFinal to boolean explicitly
    if (typeof updates.isFinal !== 'undefined') {
      const finalValue = updates.isFinal;
      if (typeof finalValue === 'string') {
        phase.isFinal = finalValue.toLowerCase() === 'yes';
      } else {
        phase.isFinal = !!finalValue; // boolean or anything truthy
      }
    }

    // Convert isDone to boolean explicitly
    if (typeof updates.isDone !== 'undefined') {
      phase.isDone = updates.isDone === true || updates.isDone === 'true';
    }

    // Update other fields
    if (updates.title !== undefined) phase.title = updates.title;
    if (updates.date !== undefined) phase.date = updates.date;
    if (updates.description !== undefined) phase.description = updates.description;
    if (updates.files !== undefined) phase.files = updates.files;
    if (updates.assignedDoctor !== undefined) phase.assignedDoctor = updates.assignedDoctor;
    if (updates.consultation !== undefined) phase.consultation = updates.consultation;

    await phase.save();

    res.status(200).json({
      message: 'Progress phase updated successfully',
      phase,
    });

  } catch (error) {
    console.error('Error updating progress phase:', error);
    res.status(500).json({ message: 'Internal server error', error: error.message });
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
