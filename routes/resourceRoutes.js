import express from "express";

import { handleEdit, handleDelete } from '../controllers/resourceController.js';

const router = express.Router();

router.put('/:id', handleEdit);

router.delete('/:id', handleDelete);

export default router;
