import { formatConversationText } from "../utils/formatConversation.js";

export const formatWithAI = async (req, res) => {
  try {
    const { rawText } = req.body;

    if (!rawText || rawText.trim().length === 0) {
      return res.status(400).json({ success: false, message: "No text provided." });
    }

    const formatted = await formatConversationText(rawText);

    return res.status(200).json({
      success: true,
      message: "Conversation formatted successfully.",
      formattedText: formatted,
    });
  } catch (error) {
    console.error("Error formatting conversation:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to format conversation.",
      error: error.message,
    });
  }
};
