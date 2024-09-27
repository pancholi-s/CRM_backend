import mongoose from 'mongoose';

const departmentSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
  },
  head: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor', // Could also be an admin or other entity
    required: false,
  },
  employees: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Employee', // This could refer to Doctor, Receptionist, or any other employee
  }],
  services: [{
    type: String,  // List of services provided by this department, e.g., ['Cardiology', 'Radiology']
  }],
});

const Department = mongoose.model('Department', departmentSchema);
export default Department;