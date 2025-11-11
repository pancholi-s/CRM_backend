import PrescriptionChat from "../models/PrescriptionChatModel.js";
import { getAIChatResponse } from "../utils/aiChatHelper.js";

export const sendChatMessage = async (req, res) => {
  try {
    const { prescriptionId, message } = req.body;
    const doctorId = req.user._id;

    if (!message || !prescriptionId) {
      return res.status(400).json({ success: false, message: "Message and prescription ID required" });
    }

    // Get or create chat thread
    let chat = await PrescriptionChat.findOne({ prescription: prescriptionId });
    if (!chat) {
      chat = new PrescriptionChat({ prescription: prescriptionId, doctor: doctorId, messages: [] });
    }

    // Add doctor message
    chat.messages.push({ role: "doctor", message });

    // Generate AI reply
    const aiReply = await getAIChatResponse(prescriptionId, chat.messages, message);

    // Save AI reply
    chat.messages.push({ role: "ai", message: aiReply });
    await chat.save();

    res.status(200).json({
      success: true,
      doctorMessage: message,
      aiReply,
      chatId: chat._id,
    });
  } catch (error) {
    console.error("Error in sendChatMessage:", error);
    res.status(500).json({ success: false, message: "Failed to send chat message" });
  }
};

export const getChatByPrescription = async (req, res) => {
  try {
    const { prescriptionId } = req.params;
    const chat = await PrescriptionChat.findOne({ prescription: prescriptionId })
      .populate("doctor", "name")
      .populate("prescription", "aiPrescription");

    if (!chat) {
      return res.status(404).json({ success: false, message: "No chat found for this prescription" });
    }

    res.status(200).json({ success: true, data: chat });
  } catch (error) {
    console.error("Error in getChatByPrescription:", error);
    res.status(500).json({ success: false, message: "Failed to fetch chat" });
  }
};
