import mongoose from 'mongoose';

const receptionistSchema = new mongoose.Schema({
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
  role: {
    type: String,
    default: 'receptionist',
    required: true,
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hospital',
    required: true,
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

export default mongoose.model('Receptionist', receptionistSchema);
