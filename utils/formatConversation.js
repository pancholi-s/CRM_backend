import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @param {string} rawText - Unformatted speech-to-text conversation.
 * @returns {Promise<string>} - Formatted, readable consultation note.
 */
export const formatConversationText = async (rawText) => {
  try {
    const prompt = `
You are a medical scribe assistant.

The following is an unstructured, messy conversation between a doctor and a patient (transcribed from voice). 
Your task is to:
- Format it into a clean, readable doctor-patient conversation.
- Use correct grammar, punctuation, and natural tone.
- Keep meaning the same (do NOT add new details).
- Clearly mark who is speaking (Doctor / Patient).
- Use short paragraphs and a human-readable format.

Here’s the raw text:
"${rawText}"

Now return the clean formatted version only. No explanations.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [{ role: "user", content: prompt }],
      temperature: 0.4,
      max_tokens: 500,
    });

    const formattedText = response?.choices?.[0]?.message?.content?.trim();
    return formattedText || "Formatting failed. Try again.";
  } catch (error) {
    console.error("Error formatting conversation:", error);
    return "Error: Could not format the conversation.";
  }
};
