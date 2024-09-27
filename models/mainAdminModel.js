import mongoose from 'mongoose';

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
    default: 'MainAdmin',
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
});

const MainAdmin = mongoose.model('MainAdmin', mainAdminSchema);
export default MainAdmin;