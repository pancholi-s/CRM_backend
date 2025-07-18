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
   roomType: {
    type: String,
    enum: ['ICU', 'General Ward', 'Private Room', 'Semi-Private', 'Operation Theater', 'Emergency', 'Pediatric Ward', 'Maternity Ward'],
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
    enum: ['Available', 'Occupied', 'Under Maintenance', 'Full'],
    default: 'Available',
    required: true,
  },
  capacity: {
    totalBeds: { type: Number, required: true, min: 1 },
    availableBeds: { type: Number, default: 0 },
  },
  features: {
    hasAC: { type: Boolean, default: false },
    hasTV: { type: Boolean, default: false },
    hasWiFi: { type: Boolean, default: false },
    hasAttachedBathroom: { type: Boolean, default: true },
  },
  floor: {
    type: Number,
    required: true,
  },
  wing: {
    type: String,
    enum: ['North', 'South', 'East', 'West', 'Central'],
    required: true,
  },
}, {
  timestamps: true,
});

// Virtual to get beds in this room
roomSchema.virtual('beds', {
  ref: 'Bed',
  localField: '_id',
  foreignField: 'room',
});

// Update available beds count when beds change
roomSchema.methods.updateAvailableBeds = async function() {
  const Bed = mongoose.model('Bed');
  
  // Get total beds in this room (regardless of status)
  const totalBedsInRoom = await Bed.countDocuments({ room: this._id });
  
  // Get available beds
  const availableBeds = await Bed.countDocuments({
    room: this._id,
    status: 'Available'
  });
  
  // Update available beds count (can't be more than total beds in room)
  this.capacity.availableBeds = availableBeds;
  
  // Update room status
  if (totalBedsInRoom === 0) {
    this.status = 'Available'; // No beds added yet
  } else if (availableBeds === 0) {
    this.status = 'Full'; // All beds are occupied
  } else if (availableBeds === totalBedsInRoom) {
    this.status = 'Available'; // All beds are available
  } else {
    this.status = 'Occupied'; // Some beds available, some occupied
  }
  
  await this.save();
};

export default mongoose.model('Room', roomSchema);
