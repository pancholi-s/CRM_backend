import Event from '../models/Event.js';

export const createEvent = async (req, res) => {
  try {
    const {
      title,
      date,
      allDay,
      startTime,
      endTime,
      participantsName,
      eventType,
      note,
      labelTag
    } = req.body;

    const allowedLabels = ['High', 'Medium', 'Low'];
    if (!allowedLabels.includes(labelTag)) {
      return res.status(400).json({ success: false, message: "Invalid label tag" });
    }

    const newEvent = new Event({
      title,
      date,
      allDay,
      startTime,
      endTime,
      participantsName,
      eventType,
      note,
      labelTag,
    });

    await newEvent.save();

    res.status(201).json({ success: true, message: "Event created successfully", event: newEvent });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};


export const getAllEvents = async (req, res) => {
  try {
    const events = await Event.find().sort({ date: 1 }); 
    res.status(200).json({ success: true, events });
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ success: false, message: "Internal server error" });
  }
};