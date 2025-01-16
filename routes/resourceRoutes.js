import express from 'express';
import { handleEdit, handleDelete } from '../controllers/resourceController.js';

const router = express.Router();

// Edit a resource (e.g., staff, room, etc.)
router.put('/:modelName/:id', handleEdit);

// Delete a resource (e.g., staff, room, etc.)
router.delete('/:modelName/:id', handleDelete);

export default router;
