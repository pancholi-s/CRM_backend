import mongoose from 'mongoose';

const hospitalAdminSchema = new mongoose.Schema({
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
  role: {
    type: String,
    default: 'HospitalAdmin',
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,  // The hospital that the admin manages
  },
  canManage: {
    type: Object,
    default: {
      doctors: true,
      patients: true,
      appointments: true,
      receptionists: true,
    },
  },
});

const HospitalAdmin = mongoose.model('HospitalAdmin', hospitalAdminSchema);
export default HospitalAdmin;