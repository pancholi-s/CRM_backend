import NewPrescription from "../models/NewPrescriptionModel.js";
import { generateAIPrescription } from "../utils/aiPrescriptionHelper.js";

export const createAIPrescription = async (req, res) => {
  try {
    const { patientId, medicalHistory, diagnosisVitals, ...otherInputs } =
      req.body;
    const doctorId = req.user._id;
    const hospitalId = req.session.hospitalId;

    if (!patientId) {
      return res
        .status(400)
        .json({ success: false, message: "Patient ID required" });
    }

    if (!diagnosisVitals) {
      return res
        .status(400)
        .json({ success: false, message: "Diagnosis and vitals required" });
    }

    const inputData = { medicalHistory, diagnosisVitals, ...otherInputs };

    const aiPrescription = await generateAIPrescription(inputData);

    const prescription = new NewPrescription({
      doctor: doctorId,
      patient: patientId,
      hospital: hospitalId,
      aiPrescription,
      inputData,
    });

    await prescription.save();

    return res.status(201).json({
      success: true,
      message: "Prescription generated successfully",
      data: prescription,
    });
  } catch (error) {
    console.error("Error in createAIPrescription:", error);
    return res.status(500).json({
      success: false,
      message: error.message || "Failed to generate prescription",
    });
  }
};

export const getPatientPrescriptions = async (req, res) => {
  try {
    const { patientId } = req.params;

    const prescriptions = await NewPrescription.find({ patient: patientId })
      .populate("doctor", "name email")
      .populate("patient", "name age diagnosis")
      .populate("hospital", "name")
      .sort({ createdAt: -1 });

    return res.status(200).json({
      success: true,
      count: prescriptions.length,
      data: prescriptions,
    });
  } catch (error) {
    console.error("Error in getPatientPrescriptions:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prescriptions",
    });
  }
};

export const getPrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const prescription = await NewPrescription.findById(id)
      .populate("doctor", "name email specialization")
      .populate("patient", "name age gender diagnosis")
      .populate("hospital", "name address");

    if (!prescription) {
      return res
        .status(404)
        .json({ success: false, message: "Prescription not found" });
    }

    return res.status(200).json({
      success: true,
      data: prescription,
    });
  } catch (error) {
    console.error("Error in getPrescriptionById:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch prescription",
    });
  }
};

export const updatePrescriptionSections = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const prescription = await NewPrescription.findById(id);

    if (!prescription) {
      return res
        .status(404)
        .json({ success: false, message: "Prescription not found" });
    }

    const allowedFields = [
      "diagnosisNote",
      "problemStatement",
      "icdCode",
      "therapyPlan",
      "medications",
      "injectionsTherapies",
      "nonDrugRecommendations",
      "precautions",
      "lifestyleDiet",
      "followUp",
      "followUpInstructions",
    ];

    allowedFields.forEach((field) => {
      if (updates[field] !== undefined) {
        prescription.aiPrescription[field] = updates[field];
      }
    });

    await prescription.save();

    return res.status(200).json({
      success: true,
      message: "Prescription updated successfully",
      data: prescription,
    });
  } catch (error) {
    console.error("Error in updatePrescriptionSections:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to update prescription",
    });
  }
};

export const approvePrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const prescription = await NewPrescription.findById(id);

    if (!prescription) {
      return res
        .status(404)
        .json({ success: false, message: "Prescription not found" });
    }

    prescription.approved = true;
    await prescription.save();

    return res.status(200).json({
      success: true,
      message: "Prescription approved successfully",
      data: prescription,
    });
  } catch (error) {
    console.error("Error in approvePrescriptionById:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to approve prescription",
    });
  }
};

export const deletePrescriptionById = async (req, res) => {
  try {
    const { id } = req.params;

    const prescription = await NewPrescription.findByIdAndDelete(id);

    if (!prescription) {
      return res
        .status(404)
        .json({ success: false, message: "Prescription not found" });
    }

    return res.status(200).json({
      success: true,
      message: "Prescription deleted successfully",
    });
  } catch (error) {
    console.error("Error in deletePrescriptionById:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to delete prescription",
    });
  }
};
