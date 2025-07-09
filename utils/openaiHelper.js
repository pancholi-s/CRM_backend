import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const parsePrescriptionTextToObject = (text) => {
  const sections = {
    problemStatement: "",
    icdCode: "",
    therapyPlan: "",
    medications: "",
    precautions: "",
    lifestyle: "",
    followUp: "",
  };

  const map = {
    "Problem Statement": "problemStatement",
    "ICD Code": "icdCode",
    "Therapy Plan": "therapyPlan",
    Medications: "medications",
    Precautions: "precautions",
    "Lifestyle & Diet": "lifestyle",
    "Follow-Up Instructions": "followUp",
  };

  let currentKey = null;

  text.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (map[trimmed]) {
      currentKey = map[trimmed];
    } else if (currentKey) {
      sections[currentKey] += (sections[currentKey] ? "\n" : "") + trimmed;
    }
  });

  return sections;
};

export const getAIPrescription = async (inputData) => {
  const prompt = `
You are a clinical assistant AI. Based on the following patient details, generate a prescription draft with these SECTIONS AS HEADERS in the same exact format:

- Problem Statement
- ICD Code
- Therapy Plan
- Medications
- Precautions
- Lifestyle & Diet
- Follow-Up Instructions

Patient Info:
Medical History: ${JSON.stringify(inputData.medicalHistory)}
Current Medications: ${JSON.stringify(inputData.currentMedications)}
Diagnosis & Vitals: ${JSON.stringify(inputData.diagnosisVitals)}

Only generate the structured draft. No explanation.
`;

  const response = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4",
    temperature: 0.3,
    max_tokens: 700,
  });

  const text = response.choices[0].message.content;

  return parsePrescriptionTextToObject(text);
};
