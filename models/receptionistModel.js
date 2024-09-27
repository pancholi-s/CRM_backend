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
  appointmentsHandled: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Appointment',
  }],
});

const Receptionist = mongoose.model('Receptionist', receptionistSchema);
export default Receptionist;