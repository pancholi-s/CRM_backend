import Event from "../models/eventModel.js";

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
      labelTag,
      note,
    } = req.body;

    const { user } = req;
    const hospitalId = user.hospital;

    const newEvent = new Event({
      title,
      date,
      allDay,
      startTime,
      endTime,
      participantsName,
      eventType,
      labelTag,
      note,
      hospital: hospitalId,
      createdBy: {
        userId: user._id,
        role: user.role,
      },
    });

    await newEvent.save();

    res.status(201).json({
      message: "Event created successfully",
      event: newEvent,
    });
  } catch (error) {
    console.error("Error creating event:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getEvents = async (req, res) => {
  try {
    const hospitalId = req.user.hospital;

    const events = await Event.find({ hospital: hospitalId }).sort({
      date: -1,
    });

    res.status(200).json(events);
  } catch (error) {
    console.error("Error fetching events:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
