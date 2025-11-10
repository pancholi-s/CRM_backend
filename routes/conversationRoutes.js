import express from "express";
import { formatWithAI } from "../controllers/conversationController.js";

const router = express.Router();

router.post("/format", formatWithAI);

export default router;
