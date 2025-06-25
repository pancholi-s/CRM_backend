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
  const availableBeds = await Bed.countDocuments({
    room: this._id,
    status: 'Available'
  });
  
  this.capacity.availableBeds = availableBeds;
  
  // Update room status based on bed availability
  if (availableBeds === 0) {
    this.status = 'Full';
  } else if (availableBeds === this.capacity.totalBeds) {
    this.status = 'Available';
  } else {
    this.status = 'Occupied';
  }
  
  await this.save();
};

export default mongoose.model('Room', roomSchema);
