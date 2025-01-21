import mongoose from 'mongoose';

const hospitalSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  address: {
    street: {
      type: String,
      required: true,
    },
    city: {
      type: String,
      required: true,
    },
    state: {
      type: String,
      required: true,
    },
    zipCode: {
      type: String,
      required: true,
    },
    country: {
      type: String,
      required: true,
    },
  },
  phone: {
    type: String,
    required: true,
    unique: true,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  website: {
    type: String,
    required: false,
  },
  departments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
  }],
  appointments: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
  }],
  RejectedAppointment: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'RejectedAppointment',
  }],
  doctors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
  }],
  receptionists: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Receptionist',
  }],
  patients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient',
  }],
  establishedDate: {
    type: Date,
    required: true,
  },
  mainAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'MainAdmin',
  },
  hospitalAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HospitalAdmin',
  },
  services: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Service',
    default: [],
  }],
  rooms: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Room',
    default: [],
  }],  
  staffs: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Staff',
    default: [],
  }],
  expenses: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Expense',
    default: []
  }],
  revenue: {
    type: Number,
    default: 0
  },
});

export default mongoose.model('Hospital', hospitalSchema);