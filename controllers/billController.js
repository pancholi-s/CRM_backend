import mongoose from "mongoose";

import Appointment from "../models/appointmentModel.js";
import Bill from "../models/billModel.js";
import Patient from "../models/patientModel.js";
import Service from "../models/serviceModel.js";
import Hospital from "../models/hospitalModel.js";

export const createBill = async (req, res) => {
  const { patientId, caseID, services, paidAmount, mode } = req.body;
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Access denied. No hospital context found." });
  }

  try {
    // Fetch patient
    const patient = await Patient.findOne({
      _id: patientId,
      hospital: hospitalId,
    }).select("name phone");

    if (!patient) {
      return res.status(404).json({ message: "Patient not found." });
    }

    // Validate appointment (caseId)
    const appointment = await Appointment.findOne({
      caseId: caseID,
      patient: patientId,
      hospital: hospitalId,
    });

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    // Validate services
    let totalAmount = 0;
    const validatedServices = [];

    for (const serviceItem of services) {
      const service = await Service.findOne({
        _id: serviceItem.serviceId,
        hospital: hospitalId,
      });

      if (!service) {
        return res
          .status(404)
          .json({ message: `Service not found: ${serviceItem.serviceId}` });
      }

      const serviceDetails = service.categories.find(
        (sub) => sub.subCategoryName === serviceItem.category
      );

      if (!serviceDetails) {
        return res
          .status(404)
          .json({ message: `Sub-category not found: ${serviceItem.category}` });
      }

      const serviceTotal = serviceDetails.rate * serviceItem.quantity;
      validatedServices.push({
        service: service._id,
        category: serviceItem.category,
        quantity: serviceItem.quantity,
        rate: serviceDetails.rate,
        total: serviceTotal,
      });

      totalAmount += serviceTotal;
    }

    const outstanding = totalAmount - paidAmount;

    const newBill = new Bill({
      patient: patient._id,
      caseId: appointment.caseId,
      services: validatedServices,
      totalAmount,
      paidAmount,
      outstanding,
      status: outstanding === 0 ? "Paid" : "Pending",
      mode,
      hospital: hospitalId,
      invoiceNumber: `INV${Date.now().toString().slice(-6)}`,
    });

    await newBill.save();

    // Update hospital revenue
    await Hospital.updateOne(
      { _id: hospitalId },
      { $inc: { revenue: paidAmount } }
    );

    res.status(201).json({ message: "Bill generated successfully.", bill: newBill });
  } catch (error) {
    res.status(500).json({ message: "Error generating bill.", error: error.message });
  }
};

export const getAllBills = async (req, res) => {
  const { hospitalId } = req.session;
  const { page = 1, limit = 10 } = req.query;
  const skip = (page - 1) * limit;

  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  try {
    const total = await Bill.countDocuments({ hospital: hospitalId });
    const bills = await Bill.find({ hospital: hospitalId })
      .populate("patient", "name phone")
      .populate("doctor", "name specialization")
      .populate("services.service", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      count: bills.length,
      totalBills: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      bills
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching bills.", error: error.message });
  }
};

export const getBillDetails = async (req, res) => {
  const { billId } = req.params;

  try {
    const bill = await Bill.findById(billId)
      .populate("patient", "name phone")
      .populate("doctor", "name specialization")
      .populate("services.service", "name categories");

    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    // Map services and group by service name
    const serviceMap = new Map();

    bill.services.forEach((item) => {
      if (!item.service) return;

      const serviceName = item.service.name || "Unknown Service";
      const selectedCategory = item.category;
      const categoryQuantity = item.quantity || 1;

      const filteredCategories = item.service.categories
        ?.filter((cat) => cat.subCategoryName === selectedCategory)  // ✅ Use subCategoryName
        .map((cat) => ({
          subCategoryName: cat.subCategoryName,  // ✅ Include subCategoryName
          rateType: cat.rateType,
          rate: cat.rate,
          quantity: categoryQuantity,
          total: (cat.rate || 0) * categoryQuantity,
        })) || [];

      if (!serviceMap.has(serviceName)) {
        serviceMap.set(serviceName, {
          name: serviceName,
          totalQuantity: categoryQuantity,
          totalCategories: filteredCategories.length,
          categories: filteredCategories,
        });
      } else {
        const existingService = serviceMap.get(serviceName);
        existingService.totalQuantity += categoryQuantity;
        existingService.categories.push(...filteredCategories);
        existingService.totalCategories = existingService.categories.length;
      }
    });

    res.status(200).json({
      invoiceNumber: bill.invoiceNumber,
      caseId: bill.caseId,
      invoiceDate: bill.invoiceDate,
      patient: bill.patient
        ? { name: bill.patient.name, phone: bill.patient.phone }
        : { name: "Unknown", phone: "N/A" },
      doctor: bill.doctor
        ? { name: bill.doctor.name, specialization: bill.doctor.specialization }
        : { name: "Unknown", specialization: "N/A" },
      services: Array.from(serviceMap.values()), // Convert map back to array
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      outstanding: bill.outstanding,
      status: bill.status,
      mode: bill.mode,
    });
  } catch (error) {
    console.error("Error fetching bill details:", error);
    res.status(500).json({ message: "Error fetching bill details.", error: error.message });
  }
};

export const getRevenueByYear = async (req, res) => {
  const { year } = req.query;
  const hospitalId = req.session.hospitalId;

  if (!hospitalId) {
    return res.status(403).json({ message: "No hospital context found." });
  }

  const targetYear = parseInt(year) || new Date().getFullYear();
  const startOfYear = new Date(`${targetYear}-01-01T00:00:00.000Z`);
  const endOfYear = new Date(`${targetYear}-12-31T23:59:59.999Z`);

  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  try {
    const revenue = await Bill.aggregate([
      {
        $match: {
          hospital: new mongoose.Types.ObjectId(hospitalId),
          invoiceDate: { $gte: startOfYear, $lte: endOfYear }
        }
      },
      {
        $group: {
          _id: { month: { $month: "$invoiceDate" } },
          totalRevenue: { $sum: "$totalAmount" },
          count: { $sum: 1 }
        }
      },
      {
        $sort: { "_id.month": 1 }
      }
    ]);

    const formatted = Array.from({ length: 12 }, (_, i) => {
      const found = revenue.find(r => r._id.month === i + 1);
      return {
        month: monthNames[i],
        revenue: found ? found.totalRevenue : 0,
        billCount: found ? found.count : 0
      };
    });

    res.status(200).json({
      year: targetYear,
      monthlyRevenue: formatted,
      totalRevenue: formatted.reduce((sum, m) => sum + m.revenue, 0),
      totalBills: formatted.reduce((sum, m) => sum + m.billCount, 0)
    });

  } catch (error) {
    console.error("Error calculating revenue:", error);
    res.status(500).json({ message: "Error calculating revenue", error: error.message });
  }
};
