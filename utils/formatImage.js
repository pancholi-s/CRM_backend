import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * @param {string} imageUrl - Cloudinary URL of the uploaded handwriting image
 * @returns {Promise<string>} - Extracted + structured clinical summary
 */
export const formatConversationImage = async (imageUrl) => {
  try {
    const prompt = `
You are an AI medical assistant specializing in handwriting recognition.
Your task:
1. Read the handwriting from the image.
2. Convert the handwritten text into clean, readable clinical notes.
3. Use a professional medical format.

Rules:
- Identify and extract Vitals, Symptoms, Observations, Assessment, Diagnosis, Plan, or Follow-up (only if present).
- DO NOT invent or add information that is not in the handwriting.
- Use bullet points for lists.
- Maintain accuracy, clarity, and professional medical writing style.
- Output ONLY the formatted clinical note.
`;

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      temperature: 0.2,
      max_tokens: 600,
      messages: [
        {
          role: "user",
          content: [
            { type: "text", text: prompt },
            {
              type: "image_url",
              image_url: {
                url: imageUrl,
              },
            },
          ],
        },
      ],
    });

    const text = response?.choices?.[0]?.message?.content?.trim();
    return text || "Unable to read handwriting.";
  } catch (error) {
    console.error("Error formatting image:", error);
    return "Error: Could not format image.";
  }
};
