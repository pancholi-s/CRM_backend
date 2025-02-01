import mongoose from 'mongoose';

const staffSchema = new mongoose.Schema({
  profile: {
    type: String, 
  },
  staff_id: {
    type: String,
    required: true,
    unique: true,
  },
  name: {
    type: String,
    required: true,
  },
  phone: {
    type: String,
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  designation: {
    type: String,
    required: true,
  },
  status: {
    type: String,
    enum: ['Available', 'On Leave'],
    default: 'Avaliable',
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
  },
});

export default mongoose.model('Staff', staffSchema);
