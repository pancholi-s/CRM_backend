import OpenAI from "openai";
import dotenv from "dotenv";
import NewPrescription from "../models/NewPrescriptionModel.js";

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export const getAIChatResponse = async (
  prescriptionId,
  chatHistory,
  userQuery
) => {
  const prescription = await NewPrescription.findById(prescriptionId)
    .populate("doctor", "name specialization")
    .populate("patient", "name age gender diagnosis");

  if (!prescription) throw new Error("Prescription not found");

  const baseContext = `
You are a medical assistant helping a doctor discuss a patient's prescription.

Here is the patient's key info:
Name: ${prescription.patient?.name}
Age: ${prescription.patient?.age}
Gender: ${prescription.patient?.gender}
Diagnosis: ${prescription.patient?.diagnosis || "N/A"}

Here is the current AI-generated prescription:
${JSON.stringify(prescription.aiPrescription, null, 2)}

Now continue the chat with the doctor naturally, giving accurate and concise medical guidance.
`;

  const messages = [
    { role: "system", content: baseContext },
    ...chatHistory.map((m) => ({
      role: m.role === "doctor" ? "user" : "assistant",
      content: m.message,
    })),
    { role: "user", content: userQuery },
  ];

  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages,
    temperature: 0.4,
    max_tokens: 300,
  });

  return response.choices[0].message.content.trim();
};
