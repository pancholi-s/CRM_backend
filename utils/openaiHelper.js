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
    medications: [],
    injectionsTherapies: [],
    nonDrugRecommendations: [],
    precautions: "",
    lifestyle: [],
    followUp: "",
    followUpInstructions: {
      reviewDate: "",
      notes: "",
    },
  };

  const sectionMap = {
    "Problem Statement": "problemStatement",
    "ICD Code": "icdCode",
    "Therapy Plan": "therapyPlan",
    Medications: "medications",
    "Injections / Therapies": "injectionsTherapies",
    "Non-Drug Recommendations": "nonDrugRecommendations",
    Precautions: "precautions",
    "Lifestyle & Diet": "lifestyle",
    "Follow-Up": "followUp",
    "Follow-Up Instructions": "followUpInstructions",
  };

  let currentKey = null;

  text.split("\n").forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    for (const label in sectionMap) {
      const pattern = new RegExp(`^(\\d+\\.\\s*)?${label}$`, "i");
      if (pattern.test(trimmed)) {
        currentKey = sectionMap[label];
        return;
      }
    }

    if (!currentKey) return;

    if (
      [
        "medications",
        "injectionsTherapies",
        "nonDrugRecommendations",
        "lifestyle",
      ].includes(currentKey)
    ) {
      if (/^[-•]\s*/.test(trimmed)) {
        sections[currentKey].push(trimmed.replace(/^[-•]\s*/, "").trim());
      }
    } else if (currentKey === "followUpInstructions") {
      if (trimmed.startsWith("Review Date:")) {
        sections.followUpInstructions.reviewDate = trimmed
          .replace("Review Date:", "")
          .trim();
      } else if (trimmed.startsWith("Notes:")) {
        sections.followUpInstructions.notes = trimmed
          .replace("Notes:", "")
          .trim();
      }
    } else if (
      [
        "problemStatement",
        "icdCode",
        "therapyPlan",
        "precautions",
        "followUp",
      ].includes(currentKey)
    ) {
      sections[currentKey] += (sections[currentKey] ? " " : "") + trimmed;
    }
  });

  return sections;
};

export const getAIPrescription = async (inputData) => {
  let patientInfo = `Medical History: ${JSON.stringify(
    inputData.medicalHistory
  )}\n`;

  Object.entries(inputData).forEach(([key, value]) => {
    if (key !== "medicalHistory" && value) {
      patientInfo += `${key.replace(/([A-Z])/g, " $1")}: ${JSON.stringify(
        value
      )}\n`;
    }
  });

  const prompt = `
You are a clinical assistant AI. Based on the following patient details, generate a short but complete structured prescription note.

Use exactly the following SECTIONS as HEADERS (no explanation, no extras):

1. Problem Statement
2. ICD Code
3. Therapy Plan
4. Medications
5. Injections / Therapies
6. Non-Drug Recommendations
7. Precautions
8. Lifestyle & Diet
9. Follow-Up
10. Follow-Up Instructions


→ Keep each section 1-3 lines max, realistic and human-like.
→ Use bullet points (with dashes) for items in Medications, Injections / Therapies, Non-Drug Recommendations, and Lifestyle & Diet.
→ For Follow-Up Instructions, clearly include "Review Date:" and "Notes:".

Patient Info:
${patientInfo}

Only generate the structured draft. No explanation, no extra text.
`;

  const response = await openai.chat.completions.create({
    messages: [{ role: "user", content: prompt }],
    model: "gpt-4",
    temperature: 0.3,
    max_tokens: 1200,
  });

  const text = response?.choices?.[0]?.message?.content?.trim();

  if (!text || text.length < 10) {
    throw new Error("OpenAI returned an empty or invalid response.");
  }

  return parsePrescriptionTextToObject(text);
};
