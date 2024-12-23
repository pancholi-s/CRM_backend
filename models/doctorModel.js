import mongoose from 'mongoose';

const doctorSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 8,
  },
  specialization: {
    type: String, // e.g., "Cardiology", "Orthopedics"
    required: false,
  },
  head: {
    type: mongoose.Schema.Types.ObjectId, // Reference to the Department model if the doctor is a head
    ref: 'Department',
    default: null,
  },
  phone: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    default: null,  
  },
  patients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
  }],
  appointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
  }],
  departments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  }],
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
  },
  availability: {
    type: [String],  // e.g., ['Monday 9:00 AM - 5:00 PM', 'Tuesday 9:00 AM - 5:00 PM']
    required: true,
  },
  role: {
    type: String,
    default: 'doctor',
    required: true,
  },
  assignedRooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
  }],  
});

const Doctor = mongoose.model('Doctor', doctorSchema);
export default Doctor;
