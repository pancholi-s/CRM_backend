import express from "express";
import {
  formatImageWithAI,
  formatWithAI,
} from "../controllers/conversationController.js";
import upload from "../middleware/fileUpload.js";

const router = express.Router();

router.post("/format", formatWithAI);
router.post("/format/image", upload.single("image"), formatImageWithAI);

export default router;