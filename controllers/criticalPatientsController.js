import CriticalPatient from "../models/criticalPatientModel.js";
import Patient from "../models/patientModel.js";

//make a patient critical
export const markPatientCritical = async (req, res) => {
  try {
    const doctorId = req.user._id;
    const hospitalId = req.session.hospitalId;
    const { patientId, severity, condition } = req.body;

    if (!patientId || !severity || !condition) {
      return res.status(400).json({
        success: false,
        message: "Patient ID, severity, and condition are required",
      });
    }

    const patient = await Patient.findById(patientId);
    if (!patient) {
      return res
        .status(404)
        .json({ success: false, message: "Patient not found" });
    }

    let existingAlert = await CriticalPatient.findOne({
      patient: patientId,
      status: "Active",
    });

    if (existingAlert) {
      existingAlert.set({
        severity,
        condition,
        doctor: doctorId,
        hospital: hospitalId,
      });

      await existingAlert.save();

      const updated = await existingAlert
        .populate("patient", "name age phone")
        .populate("doctor", "name");

      return res.status(200).json({
        success: true,
        message: "Critical alert updated successfully",
        data: updated,
      });
    }

    const criticalPatient = await CriticalPatient.create({
      patient: patientId,
      doctor: doctorId,
      hospital: hospitalId,
      severity,
      condition,
    });

    const populated = await CriticalPatient.findById(criticalPatient._id)
      .populate("patient", "name age phone")
      .populate("doctor", "name");

    res.status(201).json({
      success: true,
      message: "Patient marked as critical successfully",
      data: populated,
    });
  } catch (error) {
    console.error("Error marking critical:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Get all critical patients
export const getCriticalPatients = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    const status = req.query.status || "Active";

    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const query = { hospital: hospitalId, status };

    const total = await CriticalPatient.countDocuments(query);

    const alerts = await CriticalPatient.find(query)
      .populate("patient", "name age phone")
      .populate("doctor", "name")
      .sort({ severity: 1, createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const formatted = alerts.map((a) => ({
      _id: a._id,
      patientName: a.patient.name,
      condition: a.condition,
      severity: a.severity,
      age: a.patient.age,
      phone: a.patient.phone,
      doctorName: a.doctor.name,
    }));

    res.status(200).json({
      success: true,
      data: formatted,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("Get critical patients error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};

// Resolve a critical alert
export const resolveCriticalAlert = async (req, res) => {
  try {
    const { id } = req.params;

    const criticalPatient = await CriticalPatient.findById(id);
    if (!criticalPatient) {
      return res
        .status(404)
        .json({ success: false, message: "Alert not found" });
    }

    criticalPatient.status = "Resolved";
    await criticalPatient.save();

    const updated = await CriticalPatient.findById(id)
      .populate("patient", "name age phone")
      .populate("doctor", "name");

    res.status(200).json({
      success: true,
      message: "Critical alert resolved",
      data: updated,
    });
  } catch (error) {
    console.error("Resolve alert error:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};
