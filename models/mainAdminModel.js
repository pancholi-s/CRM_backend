import mongoose from 'mongoose';

//check afterwards
const mainAdminSchema = new mongoose.Schema({
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
    default: 'mainAdmin',
  },
  canManage: {
    type: Object,
    default: {
      hospitals: true,
      doctors: true,
      patients: true,
      appointments: true,
      receptionists: true,
    },
  },
  passwordResetToken: {
    type: String,
    default: null
  },
  passwordResetExpires: {
      type: Date,
      default: null
  },
});

export default mongoose.model('MainAdmin', mainAdminSchema);
