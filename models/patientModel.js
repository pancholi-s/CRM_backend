import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
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
  phone: {
    type: String,
    required: true,
  },
  age: {
    type: Number,
    //required: true,
  },
  medicalHistory: {
    type: [String],  // List of medical history records
    required: false,
  },
  appointments: [
    {
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
      date: { type: Date },
      status: { type: String },
    },
  ],
  doctors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
  }],
  role: {
    type: String,
    default: 'patient',
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department'
  },
});

const Patient = mongoose.model('Patient', patientSchema);
export default Patient;