import mongoose from 'mongoose';
import dotenv from 'dotenv';
import Migration from '../models/migrationModel.js';
import Hospital from '../models/hospitalModel.js';
import Department from '../models/departmentModel.js';
import Doctor from '../models/doctorModel.js';
import Patient from '../models/patientModel.js';

// Load environment variables
dotenv.config({ path: '../.env' });

console.log('MongoDB URI:', process.env.MongoDbURI); // Debugging line to check environment variable

const migrations = [
  {
    name: 'addRoomReferenceToHospital',
    up: async () => {
      await Hospital.updateMany({}, { $set: { rooms: [] } });
    },
  },
  {
    name: 'addRoomReferenceToDepartment',
    up: async () => {
      await Department.updateMany({}, { $set: { rooms: [] } });
    },
  },
  {
    name: 'addAssignedRoomsToDoctor',
    up: async () => {
      await Doctor.updateMany({}, { $set: { assignedRooms: [] } });
    },
  },
  {
    name: 'addFilesFieldToPatient',
    up: async () => {
      await Patient.updateMany({}, { $set: { files: [] } });
    },
  },
];

const runMigrations = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MongoDbURI);

    console.log('MongoDB connected successfully.');

    for (const migration of migrations) {
      const existing = await Migration.findOne({ name: migration.name });

      if (existing) {
        console.log(`Migration '${migration.name}' already applied.`);
        continue;
      }

      console.log(`Applying migration '${migration.name}'...`);
      await migration.up();
      await Migration.create({ name: migration.name });
      console.log(`Migration '${migration.name}' applied successfully.`);
    }

    console.log('All migrations executed.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();
