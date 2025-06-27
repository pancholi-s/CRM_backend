import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';
import session from 'express-session';

import authRoutes from './routes/authRoutes.js';
import appointmentRoutes from './routes/appointmentRoutes.js';
import departmentRoutes from './routes/departmentRoutes.js';
import doctorRoutes from "./routes/doctorRoutes.js" ;
import patientRoutes from "./routes/patientRoutes.js" ;
import roomRoutes from "./routes/roomRoutes.js" ;
import staffRoutes from "./routes/staffRoutes.js" ;
import serviceRoutes from './routes/serviceRoutes.js';
import billRoutes from './routes/billRoutes.js';
import expenseRoutes from './routes/expenseRoutes.js';
import resourceRoutes from './routes/resourceRoutes.js';
import eventRoutes from './routes/eventRoutes.js';
import doctorNoteRoutes from './routes/doctorNoteRoutes.js';
import requestRoutes from './routes/requestRoutes.js';
import consultationRoutes from './routes/consultationRoutes.js';
import consultationFormRoutes from "./routes/consultationFormRoutes.js";
import assignmentRoutes from './routes/assignmentRoutes.js';
import procedurerRoutes from './routes/procedureRoutes.js';
import patientOverviewRoutes from './routes/patientOverviewRoutes.js';
import bedRoutes from './routes/bedRoutes.js';
import inventoryRoutes from './routes/inventoryRoutes.js';

dotenv.config();

const app = express();

app.use(cors());
app.use(express.json());

app.use(
  session({
    secret: 'process.env.JWT_SECRET',
    resave: false,
    saveUninitialized: true,
    cookie: { secure: false }, // Set to true in production with HTTPS
  })
);

// Connect to MongoDB
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MongoDbURI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1);
  }
};
connectDB();

// Routes
app.use('/', authRoutes);
app.use('/', appointmentRoutes);
app.use('/', departmentRoutes);
app.use('/', doctorRoutes);
app.use('/', patientRoutes);
app.use('/', roomRoutes);
app.use('/', staffRoutes);
app.use('/', billRoutes);
app.use('/', serviceRoutes);
app.use('/', expenseRoutes);
app.use('/', resourceRoutes);
app.use('/events', eventRoutes);
app.use('/',doctorNoteRoutes);
app.use('/', requestRoutes);
app.use('/', consultationRoutes);
app.use("/", consultationFormRoutes);
app.use('/', assignmentRoutes);
app.use('/', procedurerRoutes);
app.use('/', patientOverviewRoutes);
app.use('/', bedRoutes);
app.use('/', inventoryRoutes);

// Base route
app.get('/', (req, res) => {
  res.send('Welcome to the CRM Backend API with MongoDB');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
