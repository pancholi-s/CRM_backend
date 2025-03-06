import jwt from "jsonwebtoken";
import dotenv from "dotenv";

import MainAdmin from "../models/mainAdminModel.js";
import HospitalAdmin from "../models/hospitalAdminModel.js";
import Doctor from "../models/doctorModel.js";
import Receptionist from "../models/receptionistModel.js";
import Patient from "../models/patientModel.js";

dotenv.config();

export const authorizeRoles = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const token = req.headers.authorization?.split(" ")[1];

      if (!token) {
        return res.status(403).json({ message: "Access denied. No token provided." });
      }

      // Verify token
      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      let user;
      switch (decoded.role) {
        case "mainAdmin":
          user = await MainAdmin.findById(decoded.userId);
          break;
        case "hospitalAdmin":
          user = await HospitalAdmin.findById(decoded.userId);
          break;
        case "doctor":
          user = await Doctor.findById(decoded.userId);
          break;
        case "receptionist":
          user = await Receptionist.findById(decoded.userId);
          break;
        case "patient":
          user = await Patient.findById(decoded.userId);
          break;
        default:
          return res.status(403).json({ message: "Invalid role. Access denied." });
      }

      if (!user) {
        return res.status(403).json({ message: "User not found. Access denied." });
      }

      if (!allowedRoles.includes(decoded.role)) {
        console.log(`Access denied.`);
        return res.status(403).json({ message: "Access denied. Insufficient permissions." });
      }

      // Attach user info to request for further processing
      req.user = user;
      req.user.role = decoded.role;

      next();
    } catch (error) {
      console.error("Authorization error:", error);
      res.status(403).json({ message: "Invalid or expired token." });
    }
  };
};
