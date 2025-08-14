import mongoose from "mongoose";
import { validateTimeRange } from "../utils/eventUtils.js";

const timeRegex = /^(0?[1-9]|1[0-2]):[0-5][0-9]\s?(AM|PM)$/i;

const eventSchema = new mongoose.Schema(
  {
    title: { type: String, required: true, trim: true },
    date: { type: Date, required: true },
    allDay: { type: Boolean, default: false },
    startTime: {
      type: String,
      required: true,
      validate: {
        validator: function (v) {
          return timeRegex.test(v);
        },
        message: "Invalid start time format",
      },
    },
    endTime: {
      type: String,
      required: true,
      validate: [
        {
          validator: function (v) {
            return timeRegex.test(v);
          },
          message: "Invalid end time format",
        },
        {
          validator: function (v) {
            return validateTimeRange(this.startTime, v);
          },
          message: "End time must be after start time",
        },
      ],
    },
    participants: [
      {
        name: { type: String, required: true, trim: true },
        image: { type: String, default: null },
        role: { type: String, trim: true },
      },
    ],
    eventType: {
      type: String,
      enum: ["Appointment", "Task", "Meeting", "Call", "Surgery", "Note"],
      required: true,
    },
    labelTag: {
      type: String,
      enum: ["High", "Medium", "Low"],
      default: "Medium",
    },
    note: { type: String, trim: true },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },
    createdBy: {
      userId: {
        type: mongoose.Schema.Types.ObjectId,
        required: true,
      },
      role: {
        type: String,
        required: true,
        enum: ["mainAdmin", "hospitalAdmin", "doctor", "receptionist"],
      },
    },
  },
  { timestamps: true }
);

eventSchema.index({ hospital: 1, date: 1 });
eventSchema.index({ hospital: 1, eventType: 1 });

export default mongoose.model("Event", eventSchema);
