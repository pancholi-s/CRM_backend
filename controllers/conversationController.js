import { uploadToCloudinary } from "../utils/cloudinary.js";
import { formatConversationText } from "../utils/formatConversation.js";
import { formatConversationImage } from "../utils/formatImage.js";

export const formatWithAI = async (req, res) => {
  try {
    const { rawText } = req.body;

    if (!rawText || rawText.trim().length === 0) {
      return res
        .status(400)
        .json({ success: false, message: "No text provided." });
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
export const formatImageWithAI = async (req, res) => {
  try {
    console.log("REQ FILE:", req.file);

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "No image uploaded",
      });
    }

    const { buffer, originalname, mimetype } = req.file;

    console.log("Uploading to Cloudinary...");

    const uploaded = await uploadToCloudinary(buffer, originalname, mimetype);

    console.log("Cloudinary URL:", uploaded.secure_url);

    console.log("Calling AI on:", uploaded.secure_url);

    const formatted = await formatConversationImage(uploaded.secure_url);

    return res.status(200).json({
      success: true,
      imageUrl: uploaded.secure_url,
      formattedText: formatted,
    });
  } catch (error) {
    console.error("FORMAT IMAGE ERROR:", error);
    res
      .status(500)
      .json({ success: false, message: "Processing failed", error });
  }
};
