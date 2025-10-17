import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * Generates a short summary of a patient's full medical history.
 *
 * @param {Object} patientData - Combined patient info, consultations, admissions, files, etc.
 * @returns {Promise<string>} - Clean summary paragraph.
 */
export const generatePatientSummary = async (patientData) => {
  try {
    const formattedHistory = JSON.stringify(patientData, null, 2);

    const prompt = `
You are a medical summarization AI assistant for hospital EMR data.

Given the patient’s full record including admission details, progress phases, and uploaded documents, generate a concise, doctor-friendly summary (4–6 lines).

Focus on:
- Key admission details (date, reason, doctor, approval)
- Progress phases (current status and trend)
- Mention any relevant document uploads (like scans, reports)
- Overall patient condition and outcome if available

Skip technical IDs or database metadata.

Here’s the full structured data:
${formattedHistory}
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini", 
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 300,
    });

    const summary = response?.choices?.[0]?.message?.content?.trim();

    if (!summary) {
      throw new Error("OpenAI returned an empty summary.");
    }

    return summary;
  } catch (error) {
    console.error("Error generating patient summary:", error);
    return "Summary could not be generated at this time.";
  }
};
