import express from 'express';
import { createEvent, getAllEvents } from '../controllers/eventController.js';

const router = express.Router();

router.post('/events', createEvent);
router.get('/events', getAllEvents); 

export default router;
