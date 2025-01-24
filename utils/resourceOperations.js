import mongoose from 'mongoose';

// Import models using ES6 syntax
import Appointment from '../models/appointmentModel.js';
import Bill from '../models/billModel.js';
import Department from '../models/departmentModel.js';
import Doctor from '../models/doctorModel.js';
import Expense from '../models/expenseModel.js';
import HospitalAdmin from '../models/hospitalAdminModel.js';
import Hospital from '../models/hospitalModel.js';
import MainAdmin from '../models/mainAdminModel.js';
import Patient from '../models/patientModel.js';
import Receptionist from '../models/receptionistModel.js';
import RejectedAppointment from '../models/rejectedAppointmentModel.js';
import RequestedAppointment from '../models/requestedAppointmentModel.js';
import Room from '../models/roomModel.js';
import Service from '../models/serviceModel.js';
import Staff from '../models/staffModel.js';

// Store all models in a single object
const models = {
  Appointment,
  Bill,
  Department,
  Doctor,
  Expense,
  HospitalAdmin,
  Hospital,
  MainAdmin,
  Patient,
  Receptionist,
  RejectedAppointment,
  RequestedAppointment,
  Room,
  Service,
  Staff,
};

export const editResource = async (id, updates, hospitalId) => {
  // Iterate over models to find the resource
  for (const [modelName, model] of Object.entries(models)) {
    const resource = await model.findOne({ _id: id, hospital: hospitalId });
    if (resource) {
      Object.assign(resource, updates); // Apply updates
      await resource.save();
      return resource;
    }
  }

  throw new Error(`Resource with id ${id} not found or access denied.`);
};

export const deleteResource = async (id, hospitalId) => {
  // Iterate over models to find the resource
  for (const [modelName, model] of Object.entries(models)) {
    const resource = await model.findOneAndDelete({ _id: id, hospital: hospitalId });
    if (resource) {
      return resource;
    }
  }

  throw new Error(`Resource with id ${id} not found or access denied.`);
};
