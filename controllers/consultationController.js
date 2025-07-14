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
      referredToDoctor,
      referredToDepartment,
      referralReason,
      preferredDate,
      preferredTime,
      treatment,
      followUpRequired // only relevant for 'complete'
    } = req.body;

    if (!hospitalId) {
      return res.status(403).json({ message: "Access denied. No hospital context found." });
    }

    if (!doctor || !patient || !appointment || !department || !consultationData || !action) {
      return res.status(400).json({ message: "All fields including action are required." });
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

    // Get caseId from appointment
    const caseId = appointmentDoc.caseId;

    // Prepare base consultation data
    const consultationPayload = {
      doctor,
      patient,
      appointment,
      department,
      consultationData,
      status: "completed",
      followUpRequired: false,
      caseId // used for grouping consultations
    };

    // Handle different actions
    if (action === "complete") {
      consultationPayload.status = "completed";
      consultationPayload.followUpRequired = followUpRequired === true;
    }

    if (action === "refer") {
      consultationPayload.status = "referred";
      consultationPayload.followUpRequired = true;
      consultationPayload.referredToDoctor = referredToDoctor;
      consultationPayload.referredToDepartment = referredToDepartment;
      consultationPayload.referralReason = referralReason;
      consultationPayload.preferredDate = preferredDate;
      consultationPayload.preferredTime = preferredTime;
    }

    if (action === "schedule") {
      consultationPayload.status = "scheduled";
      consultationPayload.followUpRequired = true;
      consultationPayload.treatment = treatment;

      // Update patient's admission recommendation if included
      const admissionRec = treatment?.admissionRecommendation === true ? "Yes" : "No";
      await Patient.findByIdAndUpdate(
        patient,
        { admissionRecommendation: admissionRec },
        { session }
      );
    }

    // Save consultation
    const newConsultation = await Consultation.create([consultationPayload], { session });

    // Mark appointment completed
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
      },
      {
        $facet: {
          topDiagnoses: [
            {
              $group: {
                _id: "$consultationData.diagnosis",
                count: { $sum: 1 },
              },
            },
            { $sort: { count: -1 } },
            { $limit: 5 },
          ],
          totalCount: [
            {
              $group: {
                _id: "$consultationData.diagnosis",
              },
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

    // 1. Fetch consultations for patient
    const consultations = await Consultation.find({ patient: patientId })
      .populate('doctor', 'name')
      .populate('department', 'name')
      .populate('appointment', 'caseId');

    // 2. Extract all unique caseIds from consultations
    const caseIds = consultations.map(c => c.appointment?.caseId).filter(Boolean);

    // 3. Fetch progress phases for those caseIds
    const phases = await ProgressPhase.find({ caseId: { $in: caseIds } })
      .populate('assignedDoctor', 'name');

    // 4. Combine and sort by date
    const progress = [
      ...consultations.map(c => ({
        type: 'consultation',
        date: c.date,
        doctor: c.doctor,
        data: c.consultationData,
        status: c.status,
        caseId: c.appointment?.caseId
      })),
      ...phases.map(p => ({
        type: 'phase',
        date: p.date,
        doctor: p.assignedDoctor,
        data: {
          title: p.title,
          description: p.description,
          files: p.files,
        },
        isCompleted: p.isCompleted,
        caseId: p.caseId
      }))
    ].sort((a, b) => new Date(a.date) - new Date(b.date));

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
      isDone,
      description,
      files
    } = req.body;

    if (!caseId || !patient || !title || !assignedDoctor) {
      return res.status(400).json({ message: 'Required fields are missing' });
    }

    const newPhase = await ProgressPhase.create({
      caseId,
      patient,
      title,
      date,
      assignedDoctor,
      isDone,
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
