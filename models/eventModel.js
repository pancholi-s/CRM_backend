import mongoose from "mongoose";

const eventSchema = new mongoose.Schema({
  title: { type: String, required: true },
  date: { type: Date, required: true },
  allDay: { type: Boolean, default: false },
  startTime: { type: String, required: true },
  endTime: { type: String, required: true },
  participantsName: { type: String, required: true },
  eventType: {
    type: String,
    enum: ["Appointment", "Task", "Meeting", "Call", "Surgery", "Note"],
    required: true
  },
  labelTag: {
    type: String,
    enum: ["High", "Medium", "Low"],
    default: "Medium"
  },
  note: { type: String },

  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Hospital",
    required: true
  },
  createdBy: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "createdBy.role"
    },
    role: {
      type: String,
      required: true,
      enum: ["mainAdmin", "hospitalAdmin", "doctor", "receptionist"]
    }
  }
}, { timestamps: true });

export default mongoose.model("Event", eventSchema);
