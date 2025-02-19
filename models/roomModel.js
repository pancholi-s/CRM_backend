import mongoose from 'mongoose';

const roomSchema = new mongoose.Schema({
  roomID: {
    type: String,
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    required: true,
  },
  assignedDoctor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Doctor',
    required: false,
  },
  status: {
    type: String,
    enum: ['Available', 'Occupied', 'Under Maintenance'],
    default: 'Available',
    required: true,
  },
});

export default mongoose.model('Room', roomSchema);
