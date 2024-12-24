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

// Base route
app.get('/', (req, res) => {
  res.send('Welcome to the CRM Backend API with MongoDB');
});

// Start the server
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
