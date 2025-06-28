import mongoose from "mongoose";
import Event from "../models/eventModel.js";
import { validateTimeRange, buildEventFilter } from "../utils/eventUtils.js";

const getModelForRole = (role) => {
  switch (role) {
    case "doctor":
      return mongoose.model("Doctor");
    case "hospitalAdmin":
      return mongoose.model("HospitalAdmin");
    case "receptionist":
      return mongoose.model("Receptionist");
    default:
      return null;
  }
};

export const createEvent = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId)
      return res.status(400).json({ message: "Hospital context missing" });

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

    if (!title || !date || !participantsName || !eventType) {
      return res.status(400).json({ message: "Required fields missing" });
    }

    if (
      !allDay &&
      (!startTime || !endTime || !validateTimeRange(startTime, endTime))
    ) {
      return res.status(400).json({ message: "Invalid or missing times" });
    }

    const eventDate = new Date(date);
    if (isNaN(eventDate.getTime()))
      return res.status(400).json({ message: "Invalid date" });
    eventDate.setUTCHours(0, 0, 0, 0);

    const newEvent = await Event.create({
      title: title.trim(),
      date: eventDate,
      allDay: !!allDay,
      startTime: allDay ? undefined : startTime,
      endTime: allDay ? undefined : endTime,
      participantsName: participantsName.trim(),
      eventType,
      labelTag: labelTag || "Medium",
      note: note?.trim(),
      hospital: hospitalId,
      createdBy: {
        userId: req.user._id,
        role: req.user.role,
      },
    });

    res.status(201).json({ message: "Event created", event: newEvent });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res
        .status(400)
        .json({
          message: "Validation error",
          errors: Object.values(err.errors).map((e) => e.message),
        });
    }
    res.status(500).json({ message: "Server error" });
  }
};

export const getEvents = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId)
      return res.status(400).json({ message: "Hospital context missing" });

    const filter = buildEventFilter(hospitalId, req.query);
    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 50, 1), 100);
    const skip = (page - 1) * limit;

    const events = await Event.find(filter)
      .sort({ date: 1, startTime: 1 })
      .skip(skip)
      .limit(limit)
      .lean();

    for (const event of events) {
      const role = event.createdBy?.role;
      const userId = event.createdBy?.userId;
      if (role && userId) {
        const Model = getModelForRole(role);
        if (Model) {
          const user = await Model.findById(userId)
            .select("name email phone")
            .lean();
          event.createdBy.userInfo = user || null;
        }
      }
    }

    const total = await Event.countDocuments(filter);

    res.status(200).json({
      events,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(total / limit),
        totalEvents: total,
        eventsPerPage: limit,
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    });
  } catch (err) {
    console.error("Get Events Error:", err);
    res.status(500).json({ message: "Server error" });
  }
};

export const getEventById = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId)
      return res.status(400).json({ message: "Hospital context missing" });

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findOne({
      _id: req.params.id,
      hospital: hospitalId,
    }).lean();

    if (!event) return res.status(404).json({ message: "Event not found" });

    const role = event.createdBy?.role;
    const userId = event.createdBy?.userId;
    if (role && userId) {
      const Model = getModelForRole(role);
      if (Model) {
        const user = await Model.findById(userId)
          .select("name email phone")
          .lean();
        event.createdBy.userInfo = user || null;
      }
    }

    res.status(200).json(event);
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const updateEvent = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId)
      return res.status(400).json({ message: "Hospital context missing" });

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const updates = { ...req.body };
    delete updates.hospital;
    delete updates.createdBy;

    if (updates.startTime && updates.endTime && !updates.allDay) {
      if (!validateTimeRange(updates.startTime, updates.endTime)) {
        return res.status(400).json({ message: "Invalid time range" });
      }
    }

    if (updates.date) {
      updates.date = new Date(updates.date);
      updates.date.setUTCHours(0, 0, 0, 0);
    }

    if (updates.allDay) {
      updates.startTime = undefined;
      updates.endTime = undefined;
    }

    const event = await Event.findOneAndUpdate(
      { _id: req.params.id, hospital: hospitalId },
      updates,
      { new: true, runValidators: true }
    );

    if (!event) return res.status(404).json({ message: "Event not found" });

    res.status(200).json({ message: "Event updated", event });
  } catch (err) {
    if (err.name === "ValidationError") {
      return res
        .status(400)
        .json({
          message: "Validation error",
          errors: Object.values(err.errors).map((e) => e.message),
        });
    }
    res.status(500).json({ message: "Server error" });
  }
};

export const deleteEvent = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId)
      return res.status(400).json({ message: "Hospital context missing" });

    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ message: "Invalid event ID" });
    }

    const event = await Event.findOneAndDelete({
      _id: req.params.id,
      hospital: hospitalId,
    });

    if (!event) return res.status(404).json({ message: "Event not found" });

    res.status(200).json({ message: "Event deleted" });
  } catch (err) {
    res.status(500).json({ message: "Server error" });
  }
};

export const getEventStats = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context missing" });
    }

    const filter = buildEventFilter(hospitalId, req.query);
    const now = new Date();
    const nextWeek = new Date(now.getTime() + 7 * 86400000);

    const objectIdHospital = new mongoose.Types.ObjectId(hospitalId);

    const [totalEvents, eventsByType, eventsByPriority, upcomingEvents] =
      await Promise.all([
        Event.countDocuments(filter),
        Event.aggregate([
          {
            $match: {
              hospital: objectIdHospital,
              eventType: { $exists: true, $ne: null },
            },
          },
          { $group: { _id: "$eventType", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Event.aggregate([
          {
            $match: {
              hospital: objectIdHospital,
              labelTag: { $exists: true, $ne: null },
            },
          },
          { $group: { _id: "$labelTag", count: { $sum: 1 } } },
          { $sort: { count: -1 } },
        ]),
        Event.countDocuments({
          hospital: objectIdHospital,
          date: { $gte: now, $lte: nextWeek },
        }),
      ]);

    res.status(200).json({
      totalEvents,
      upcomingEvents,
      eventsByType,
      eventsByPriority,
    });
  } catch (err) {
    console.error("getEventStats error:", err);
    res.status(500).json({ message: "Server error" });
  }
};
