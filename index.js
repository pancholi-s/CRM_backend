// Import necessary modules
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import mongoose from 'mongoose';

// Initialize dotenv to read .env file
dotenv.config();

// Create an instance of Express app
const app = express();

// Middleware to handle CORS and JSON requests
app.use(cors());
app.use(express.json());

// MongoDB connection using Mongoose
const connectDB = async () => {
  try {
    await mongoose.connect(process.env.MongoDbURI);
    console.log('MongoDB connected successfully');
  } catch (error) {
    console.error('MongoDB connection failed:', error.message);
    process.exit(1); // Exit process with failure
  }
};

// Call the connection function
connectDB();

// Define a basic route
app.get('/', (req, res) => {
  res.send('Welcome to the CRM Backend API with MongoDB');
});

// Define a port to listen on from the environment variables or fallback to 5000
const PORT = process.env.PORT || 5000;

// Start the server
app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});