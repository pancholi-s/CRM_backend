import Prescription from "../models/PrescriptionModel.js";
import { getAIPrescription } from "../utils/openaiHelper.js";

export const generatePrescription = async (req, res) => {
  try {
    const { patientId, medicalHistory, currentMedications, diagnosisVitals } =
      req.body;
    const doctorId = req.user._id;
    const hospitalId = req.session.hospitalId;

    if (
      !patientId ||
      !medicalHistory ||
      !currentMedications ||
      !diagnosisVitals
    ) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const inputData = {
      medicalHistory,
      currentMedications,
      diagnosisVitals,
    };

    const aiResponse = await getAIPrescription(inputData);

    const newPrescription = new Prescription({
      doctor: doctorId,
      patient: patientId,
      hospital: hospitalId,
      aiGeneratedText: aiResponse,
      inputData,
    });

    await newPrescription.save();

    res.status(201).json({
      message: "AI Prescription generated successfully.",
      data: newPrescription,
    });
  } catch (error) {
    console.error("Error generating prescription:", error);
    res.status(500).json({ message: "Something went wrong." });
  }
};

export const getPrescriptionsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params;

    const prescriptions = await Prescription.find({ patient: patientId })
      .populate("doctor", "name email")
      .sort({ createdAt: -1 });

    res.status(200).json({ data: prescriptions });
  } catch (error) {
    console.error("Error fetching prescriptions:", error);
    res.status(500).json({ message: "Failed to fetch prescriptions." });
  }
};

export const updatePrescription = async (req, res) => {
  try {
    const { id } = req.params;
    const { updatedText } = req.body;

    if (!updatedText || typeof updatedText !== "object") {
      return res
        .status(400)
        .json({ message: "updatedText must be a valid object." });
    }

    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found." });
    }

    const fields = [
      "problemStatement",
      "icdCode",
      "therapyPlan",
      "medications",
      "precautions",
      "lifestyle",
      "followUp",
    ];

    fields.forEach((field) => {
      if (updatedText[field]) {
        prescription.aiGeneratedText[field] = updatedText[field];
      }
    });

    prescription.updatedAt = new Date();
    await prescription.save();

    res.status(200).json({
      message: "Prescription updated.",
      data: prescription,
    });
  } catch (error) {
    console.error("Error updating prescription:", error);
    res.status(500).json({ message: "Failed to update prescription." });
  }
};

export const approvePrescription = async (req, res) => {
  try {
    const { id } = req.params;

    const prescription = await Prescription.findById(id);

    if (!prescription) {
      return res.status(404).json({ message: "Prescription not found." });
    }

    prescription.approved = true;
    prescription.updatedAt = new Date();

    await prescription.save();

    res.status(200).json({
      message: "Prescription approved successfully.",
      data: prescription,
    });
  } catch (error) {
    console.error("Error approving prescription:", error);
    res.status(500).json({ message: "Failed to approve prescription." });
  }
};
