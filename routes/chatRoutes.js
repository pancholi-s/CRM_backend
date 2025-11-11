import express from "express";
import { sendChatMessage, getChatByPrescription } from "../controllers/chatController.js";
import { authorizeRoles } from "../middleware/roleMiddleware.js";

const router = express.Router();

router.post("/send", authorizeRoles("doctor"), sendChatMessage);
router.get("/prescription/:prescriptionId", authorizeRoles("doctor"), getChatByPrescription);

export default router;
