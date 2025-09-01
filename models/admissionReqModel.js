// models/admissionRequestModel.js
import mongoose from 'mongoose';

const admissionRequestSchema = new mongoose.Schema({
  patient: { type: mongoose.Schema.Types.ObjectId, ref: 'Patient', required: true },
  hospital: { type: mongoose.Schema.Types.ObjectId, ref: 'Hospital', required: true },
  doctor: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' }, // doctor who recommended admission
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, // staff who submitted
  caseId: { type: String, unique: true },
  status: {
    type: String,
    enum: ['Pending', 'Approved', 'Rejected',"Admitted","discharged"],
    default: 'Pending'
  },
  sendTo: {
    type: String,
    enum: ['Doctor', 'Admin', 'Both'],
    required: true
  },
  approval: {
    doctor: {
      approved: { type: Boolean, default: false },
      signature: { type: String }, // file path or string
      approvedAt: { type: Date }
    },
    admin: {
      approved: { type: Boolean, default: false },
      signature: { type: String },
      approvedAt: { type: Date }
    }
  },
  admissionDetails: {
    name: { type: String, required: true },
    contact: { type: String, required: true },
    address: { type: String, required: true },
    age: { type: Number, required: true },
    gender:{type: String, enum:['Male','Female','Other']},
    emergencyContact: { type: String },
    emergencyName: { type: String },
    medicalNote: { type: String },
    date: { type: Date, required: true },
    room: { type: mongoose.Schema.Types.ObjectId, ref: 'Room', required: true },
    bed: { type: mongoose.Schema.Types.ObjectId, ref: 'Bed', required: true },
    deposit: { type: Number },
    insurance: {
      hasInsurance: { type: Boolean, default: false },
      employerName: String,
      insuranceIdNumber: String,
      policyNumber: String,
      insuranceCompany: String ,
      employeeCode: String,
      insuranceStartDate: Date,
      insuranceExpiryDate: Date,
      insuranceApproved:{ type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
      amountApproved: { type: Number, default:0 }
    }
  },
}, {
  timestamps: true
});

export default mongoose.model('AdmissionRequest', admissionRequestSchema);
