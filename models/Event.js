import mongoose from "mongoose";

const EventSchema = new mongoose.Schema(
  {
    title: {
      type: String,
      required: true,
    },
    date: {
      type: Date,
      required: true,
    },
    allDay: {
      type: Boolean,
      default: false,
    },
    startTime: {
      type: String,
      required: true,
    },
    endTime: {
      type: String,
      required: true,
    },
    participantsName: {
      type: String,
      required: true,
    },
    eventType: {
      type: String,
      enum: ["Appointment", "Task", "Meeting", "Call", "Note"],
      required: true,
    },
    note: {
      type: String,
      default: "",
    },
    labelTag: {
      type: String,
      enum: ["High", "Medium", "Low"],
      required: true,
    },
  },
  {
    timestamps: true,
  }
);

const Event = mongoose.model("Event", EventSchema);
export default Event;
