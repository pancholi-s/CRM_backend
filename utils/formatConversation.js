import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @param {string} rawText - Unformatted medical text (doctor's notes or speech transcription)
 * @returns {Promise<string>} - Formatted, structured clinical summary
 */
export const formatConversationText = async (rawText) => {
  try {
    const prompt = `
You are an AI medical assistant that formats messy or unstructured clinical text 
into a clean, readable, structured note for electronic health records.

Rules:
- Analyze the given raw text carefully.
- Identify relevant sections like **Vitals**, **Symptoms**, **Observations**, **Assessment**, **Diagnosis**, **Plan**, **Treatment**, or **Follow-up**.
- Use only the sections that make sense (do not invent data or add missing ones).
- Use bullet points (• or -) for lists.
- Use medical writing style: short, clear, professional.
- Preserve all medical details accurately.
- Do not include any explanation — just return the formatted output.

Example Input:
"Vitals: BP 130/85, HR 78 bpm, Temp 98.6F. Patient reports occasional dizziness in the morning, especially when standing up quickly. No chest pain or nausea. History of mild anemia. Recommended iron-rich diet and morning hydration. Will check hemoglobin levels next visit."

Example Output:
Vitals:
- BP: 130/85 mmHg
- HR: 78 bpm
- Temperature: 98.6°F

Assessment:
- Occasional dizziness upon standing
- No chest pain or nausea
- History of mild anemia

Plan:
- Iron-rich diet
- Hydration in the morning
- Recheck hemoglobin next visit

Now format this raw text in the same structured style:

"${rawText}"
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.3,
      max_tokens: 500,
    });

    const formattedText = response?.choices?.[0]?.message?.content?.trim();
    return formattedText || "Formatting failed. Try again.";
  } catch (error) {
    console.error("Error formatting conversation:", error);
    return "Error: Could not format the conversation.";
  }
};
