import mongoose from "mongoose";

import Appointment from "../models/appointmentModel.js";
import Bill from "../models/billModel.js";
import Patient from "../models/patientModel.js";
import Service from "../models/serviceModel.js";
import Hospital from "../models/hospitalModel.js";
import EstimatedBill from "../models/estimatedBillModel.js";
import AdmissionRequest from '../models/admissionReqModel.js';

export const createBill = async (req, res) => {
  const { patientId, caseID, services, paidAmount, mode } = req.body;
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return { error: "Access denied. No hospital context found." }; // Return an error instead of sending a response directly
  }

  try {
    // Fetch patient
    const patient = await Patient.findOne({
      _id: patientId,
      hospital: hospitalId,
    }).select("name phone");

    if (!patient) {
      return { error: "Patient not found." };
    }

    // Validate appointment (caseId)
    const appointment = await Appointment.findOne({
      caseId: caseID,
      patient: patientId,
      hospital: hospitalId,
    });

    if (!appointment) {
      return { error: "Appointment not found." };
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
        return { error: `Service not found: ${serviceItem.serviceId}` };
      }

      const serviceDetails = service.categories.find(
        (sub) => sub.subCategoryName === serviceItem.category
      );

      if (!serviceDetails) {
        return { error: `Sub-category not found: ${serviceItem.category}` };
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

    // Instead of sending a response, return the new bill object
    return { success: true, bill: newBill };
  } catch (error) {
    return { error: `Error generating bill: ${error.message}` };
  }
};

export const getAllBills = async (req, res) => {
  const { hospitalId } = req.session;
  const { page = 1, limit = 10 , search = ""} = req.query;
  const skip = (page - 1) * limit;

  if (!hospitalId) {
    return res.status(403).json({ message: "Access denied. No hospital context found." });
  }

  try {
    let filter = { hospital: hospitalId };

    if (search) {
      const matchingPatients = await Patient.find({
        name: { $regex: search, $options: "i" }
      }).select("_id");

      const patientIds = matchingPatients.map(p => p._id);

      filter.$or = [
        { caseId: { $regex: search, $options: "i" } },
        { invoiceNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { patient: { $in: patientIds } }  
      ];
    }

    const total = await Bill.countDocuments(filter);

    const bills = await Bill.find(filter)
      .populate("patient", "name phone")
      .populate("doctor", "name specialization")
      .populate("services.service", "name")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const formattedBills = bills.map(bill => ({
      _id: bill._id,
      caseId: bill.caseId,
      patient: bill.patient,
      doctor: bill.doctor,
      services: bill.services.map(service => ({
        service: service.service,
        category: service.category,
        quantity: service.quantity,
        rate: service.rate,
        details: service.details 
      })),
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      outstanding: bill.outstanding,
      status: bill.status,
      invoiceNumber: bill.invoiceNumber,
      invoiceDate: bill.invoiceDate,
      mode: bill.mode,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt
    }));

    res.status(200).json({
      count: formattedBills.length,
      totalBills: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      bills: formattedBills
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

    const admissionRequest = await AdmissionRequest.findOne({ caseId: bill.caseId });
    const insuranceCompany = admissionRequest?.admissionDetails?.insurance?.insuranceCompany || "N/A";


    // Prepare the services and include all necessary details
    const services = bill.services.map((item) => {
      // If the service is available, return the details
      let serviceDetails = item.details || {};  // Ensure details is included

      if (item.service) {
        // Add additional information from the Service categories
        const serviceName = item.service.name || "Unknown Service";
        const categories = item.service.categories || [];
        
        // Find the matching category (based on subCategoryName)
        const selectedCategory = categories.find(
          (category) => category.subCategoryName === item.category
        ) || {};

        serviceDetails = {
          ...serviceDetails,
          rate: selectedCategory.rate || 0,  // Ensure rate is included
          rateType: selectedCategory.rateType || "Unknown",
        };

        return {
          serviceId: item.service._id,  // Use service ID for reference
          service: item.service.name || "Unknown Service",
          category: item.category || "Unknown Category",
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          details: serviceDetails,
        };
      } else {
        // If the service is null (e.g., Unknown Room), include the details directly
        return {
          serviceId: null,  // No service ID for custom expenses
          service: "Unknown Service",
          category: item.category || "Unknown Category",
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          details: serviceDetails,  // The details already exist as input
        };
      }
    });

    const payments = bill.payments || [];

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
      insuranceCompany,
      deposit: bill.deposit,
      services,
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      outstanding: bill.outstanding,
      status: bill.status,
      mode: bill.mode,
      payments,
    });
  } catch (error) {
    console.error("Error fetching bill details:", error);
    res.status(500).json({ message: "Error fetching bill details.", error: error.message });
  }
};

export const getBillsByPatient = async (req, res) => {
  try {
    const { patientId } = req.params; // Get patientId from URL params

    if (!patientId) {
      return res.status(400).json({ message: "Patient ID is required." });
    }

    // Fetch all bills for the given patientId and populate required fields
    const bills = await Bill.find({ patient: patientId })
      .populate("patient", "name phone")  // Populate patient fields (name and phone)
      .populate("doctor", "name specialization")  // Populate doctor fields (name and specialization)
      .populate("services.service", "name categories") // Populate service fields (name and categories)
      .exec();

    if (!bills || bills.length === 0) {
      return res.status(404).json({ message: "No bills found for this patient." });
    }

    // Map services and group by service name (same as in getBillDetails function)
    const formattedBills = bills.map((bill) => {
      const serviceMap = new Map();

      bill.services.forEach((item) => {
        if (!item.service) return; // Skip if no service is available

        const serviceName = item.service ? item.service.name : "Unknown Service"; // Handle unknown services
        const selectedCategory = item.category;
        const categoryQuantity = item.quantity || 1;

        // Filter categories based on subCategoryName and map their details
        const filteredCategories = item.service.categories
          ?.filter((cat) => cat.subCategoryName === selectedCategory)  // ✅ Use subCategoryName
          .map((cat) => ({
            subCategoryName: cat.subCategoryName,  // ✅ Include subCategoryName
            rateType: cat.rateType,
            rate: cat.rate,
            quantity: categoryQuantity,
            total: (cat.rate || 0) * categoryQuantity,
          })) || [];

        // Add to map service data
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

      // Handle unknown services (e.g., "Unknown Room") and add to the service map manually
      bill.services.forEach((item) => {
        if (item.service === null) {  // Handle services marked as null
          const serviceName = "Unknown Room";
          const details = item.details;

          const unknownCategory = {
            subCategoryName: "Unknown Category",
            rateType: "Unknown",
            rate: item.rate || 0,
            quantity: item.quantity || 1,
            total: (item.rate || 0) * (item.quantity || 1),
          };

          if (!serviceMap.has(serviceName)) {
            serviceMap.set(serviceName, {
              name: serviceName,
              totalQuantity: item.quantity || 1,
              totalCategories: 1,
              categories: [unknownCategory],
            });
          } else {
            const existingService = serviceMap.get(serviceName);
            existingService.totalQuantity += item.quantity || 1;
            existingService.categories.push(unknownCategory);
            existingService.totalCategories = existingService.categories.length;
          }
        }
      });

      // Return a formatted bill with the correct structure
      return {
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
        invoiceDate: bill.invoiceDate,
        createdAt: bill.createdAt,
        updatedAt: bill.updatedAt,
        hospital: bill.hospital, // Returning the hospital ID
      };
    });

    // Send the response back
    res.status(200).json({
      message: "Bills fetched successfully",
      bills: formattedBills,
    });
  } catch (error) {
    console.error("Error fetching bills:", error);
    res.status(500).json({
      message: "Error fetching bills.",
      error: error.message,
    });
  }
};




export const editBillDetails = async (req, res) => {
  const { billId } = req.params;
  const { services, paidAmount, status, mode } = req.body;

  try {
    let bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    if (services && Array.isArray(services)) {
      bill.services = services.map((service) => ({
        service: service.service || null,
        category: service.category,
        quantity: service.quantity || 1,
        rate: service.rate || 0,
        details: service.details || {},
      }));
    }

    // recalc total
    bill.totalAmount = bill.services.reduce(
      (sum, item) => sum + (item.quantity || 1) * (item.rate || 0),
      0
    );

    if (paidAmount !== undefined) {
      bill.paidAmount = paidAmount;
    }

    bill.outstanding = bill.totalAmount - bill.paidAmount;

    if (status) bill.status = status;
    if (mode) bill.mode = mode;

    await bill.save();

    const updatedBill = await Bill.findById(billId)
      .populate("patient", "name phone email patId")
      .populate("doctor", "name specialization")
      .populate("services.service", "name description categories");

    res.status(200).json({
      message: "Bill updated successfully",
      bill: updatedBill.toObject(), // 🔑 returns whole doc
    });
  } catch (error) {
    console.error("Error updating bill:", error);
    res.status(500).json({ message: "Error updating bill.", error: error.message });
  }
};


export const addToBill = async (req, res) => {
  const { billId } = req.params;
  const { category, quantity, rate, details } = req.body;

  if (!mongoose.Types.ObjectId.isValid(billId)) {
    return res.status(400).json({ message: "Invalid Bill ID format." });
  }

  try {
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    const billedDateStr =
      details?.billedDate || new Date().toISOString().split("T")[0];

    const exists = bill.services.some(
      (s) => s.category === category && s.details?.billedDate === billedDateStr
    );
    if (exists) {
      return res
        .status(400)
        .json({ message: `Entry for ${category} already exists on ${billedDateStr}.` });
    }

    const newExpense = {
      service: null,
      category,
      quantity,
      rate,
      details: {
        ...details,
        daysOccupied: 1,
        totalCharge: rate * quantity,
        billedDate: billedDateStr,
      },
    };

    bill.services.push(newExpense);
    bill.totalAmount += rate * quantity;
    bill.outstanding = bill.totalAmount - bill.paidAmount;

    bill.lastBilledAt = new Date();

    await bill.save();

    const updatedBill = await Bill.findById(billId)
      .populate("patient", "name phone email patId")
      .populate("doctor", "name specialization")
      .populate("services.service", "name description categories");

    res.status(200).json({
      message: "Expense added successfully.",
      bill: updatedBill.toObject(), // 🔑 whole doc
    });
  } catch (error) {
    console.error("Error adding expense:", error);
    res.status(500).json({ message: "Error adding expense.", error: error.message });
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


export const createEstimatedBill = async (req, res) => {
  try {
    const { admissionRequestId, grandTotal, categories } = req.body;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) return res.status(403).json({ message: "No hospital context." });

    const admissionRequest = await AdmissionRequest.findById(admissionRequestId).populate("patient");
    if (!admissionRequest) {
      return res.status(404).json({ message: "Admission request not found." });
    }

    const newEstimate = new EstimatedBill({
      admissionRequest: admissionRequest._id,
      hospital: hospitalId,
      grandTotal,
      categories
    });

    await newEstimate.save();

    res.status(201).json({
      message: "Estimated bill created successfully",
      estimate: newEstimate,
      patient: {
        id: admissionRequest.patient._id,
        name: admissionRequest.patient.name,
        hasInsurance: admissionRequest.patient.hasInsurance,
        insurance: admissionRequest.patient.insuranceDetails
      }
    });
  } catch (error) {
    console.error("Error creating estimated bill:", error);
    res.status(500).json({ message: "Error creating estimated bill", error: error.message });
  }
};

// ✅ GET: all estimates for one admission
export const getEstimatedBills = async (req, res) => {
  try {
    const { admissionRequestId } = req.params;

    const estimates = await EstimatedBill.find({ admissionRequest: admissionRequestId })
      .populate({
        path: "admissionRequest",
        populate: { path: "patient", select: "name patId hasInsurance insuranceDetails" }
      })
      .sort({ createdAt: -1 });

    if (!estimates.length) {
      return res.status(404).json({ message: "No estimated bills found for this admission request." });
    }

    res.status(200).json({
      message: "Estimated bills fetched successfully",
      count: estimates.length,
      estimates
    });
  } catch (error) {
    res.status(500).json({ message: "Error fetching estimated bills", error: error.message });
  }
};

export const editEstimatedBill = async (req, res) => {
  try {
    const { estimateId } = req.params;
    const { grandTotal, categories, isFinalized } = req.body;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res.status(403).json({ message: "No hospital context." });
    }

    // Find bill
    const estimate = await EstimatedBill.findOne({ _id: estimateId, hospital: hospitalId });
    if (!estimate) {
      return res.status(404).json({ message: "Estimated bill not found." });
    }

    // Update fields if provided
    if (grandTotal !== undefined) estimate.grandTotal = grandTotal;
    if (categories && Array.isArray(categories)) estimate.categories = categories;
    if (typeof isFinalized === "boolean") estimate.isFinalized = isFinalized;

    await estimate.save();

    res.status(200).json({
      message: "Estimated bill updated successfully",
      estimate,
    });
  } catch (error) {
    console.error("Error updating estimated bill:", error);
    res.status(500).json({ message: "Error updating estimated bill", error: error.message });
  }
};

export const addPayment = async (req, res) => {
  try {
    const { billId } = req.params;
    const { amount, mode, reference } = req.body;

    const bill = await Bill.findById(billId);
    if (!bill) return res.status(404).json({ message: "Bill not found." });

    // Record payment
    bill.payments.push({
      amount,
      mode: mode || "Cash",
      reference: reference || "Payment",
      date: new Date(),
    });

    // Update totals
    bill.paidAmount += amount;
    bill.outstanding = Math.max(bill.totalAmount - bill.paidAmount, 0);

    if (bill.paidAmount >= bill.totalAmount) bill.status = "Paid";

    await bill.save();

    res.status(200).json({ message: "Payment added successfully", bill });
  } catch (error) {
    console.error("Error adding payment:", error);
    res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
