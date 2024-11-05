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
    type: String,
    //required: true,
  },
  head: {         //if the doctor is head of particular department, fetch the name accordingly
    type: String,
    //required: true,
  },
  phone: {
    type: String,
    required: true,
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
  availability: {
    type: [String],  // ['Monday 9:00 AM - 5:00 PM', 'Tuesday 9:00 AM - 5:00 PM']
    //required: true,
  },
  role: {
    type: String,
    default: 'doctor',
    required: true,
  }
});

const Doctor = mongoose.model('Doctor', doctorSchema);
export default Doctor;