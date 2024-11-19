import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  head: {
    type: {
      id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Doctor', // Reference to the department head (Doctor)
        required: true,
      },
      name: {
        type: String,
        required: true,
      },
    },
  },
  patients: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Patient', // Reference to patients assigned to this department
  }],
  doctors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor', // Reference to doctors in this department
  }],
  specialistDoctors: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor', // Reference to specialist doctors
  }],
  nurses: [{
    type: String,
  }],
  services: [{
    type: String, // List of active services provided by this department, e.g., ['ECG', 'Cardiology']
  }],
  specializedProcedures: [{
    type: String,
    required: false
  }],
  facilities: [{
    type: String,
    required: false
  }],
  criticalEquipments: [{
    type: String,
    required: false
  }],
  equipmentMaintenance: [{
    type: String,
    required: false
  }],
});

const Department = mongoose.model('Department', departmentSchema);
export default Department;
