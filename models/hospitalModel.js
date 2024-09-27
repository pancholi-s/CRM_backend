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
      required: false,
    },
    country: {
      type: String,
      required: false,
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
    ref: 'Department', // Referencing the Department model
  }],
  employees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee', // General employee list
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
    ref: 'MainAdmin', // Reference to the MainAdmin model
  },
  hospitalAdmin: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'HospitalAdmin', // Reference to the HospitalAdmin model
  },
  services: [{
    type: String,  // List of services offered by the hospital, e.g. ['Cardiology', 'Surgery', etc.]
  }],
});

const Hospital = mongoose.model('Hospital', hospitalSchema);
export default Hospital;