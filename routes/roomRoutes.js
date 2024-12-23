import express from 'express';
import {
  addRoom,
  getRooms,
  editRoom,
  deleteRoom,
} from '../controllers/roomController.js';

const router = express.Router();

// Create a new room
router.post('/addRoom', addRoom);

// Get rooms (with optional filtering by hospital and department)
router.get('/getRooms', getRooms);

// Edit a room
router.put('/editRoom/:id', editRoom);

// Delete a room
router.delete('/deleteRoom/:id', deleteRoom);

export default router;
