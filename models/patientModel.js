import mongoose from 'mongoose';

const patientSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
  },

  gender: {
    type: String,
    required: true,
  },

  birthday: {
    type: String,
    required: true,
  },

  address: {
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

  medicalHistory: [{
    type: [String],  // List of medical history records
  }],

  currentMedication: [{
    type: String,

  }],

  symptoms: [{
    type: String,

  }],

  socialHistory: [{
    type: String,

  }],

  healingProgress: [{
    type: String,

  }],

  goals: [{
    type: String,

  }],

  nextStep: [{
    type: String,

  }],


  registrationDate: {
    type: Date,
    default: Date.now, // Automatically sets the registration date when a patient is created
  },

  profilePhoto: {
    type: String, // Store the file path or URL of the profile photo
    required: false,
  },

  appointments: [
    {
      doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
      date: { type: Date },
      status: { type: String },
    },
  ],

  //can be used as asserted by
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
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital'
  },

  status: {
    enum:["active","inactive"]
  },

  files: [{
    fileName: { type: String, required: true }, // Name of the file
    fileType: { type: String, required: true }, // Type of the file (e.g., "PDF", "Image")
    fileUrl: { type: String, required: true },  // URL or path to download the file
    uploadedAt: { type: Date, default: Date.now }, // Timestamp when the file was uploaded
    description: { type: String, required: false }, // Optional description of the file
  }],

});

const Patient = mongoose.model('Patient', patientSchema);
export default Patient;