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
          service: item.service.name || "Unknown Service",
          category: item.category || "Unknown Category",
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          details: serviceDetails,
        };
      } else {
        // If the service is null (e.g., Unknown Room), include the details directly
        return {
          service: "Unknown Service",
          category: item.category || "Unknown Category",
          quantity: item.quantity || 1,
          rate: item.rate || 0,
          details: serviceDetails,  // The details already exist as input
        };
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
      services: services, // Now returning all services with correct details
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
  const { billId } = req.params;  // Get billId from URL params
  const { services, paidAmount, status, mode } = req.body;  // Extract fields from request body

  try {
    // Fetch the bill by its ID
    let bill = await Bill.findById(billId)
      .populate("services.service", "name categories");

    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    // Update the services (if provided in the request body)
    if (services) {
      bill.services = services;
    }

    // Recalculate totalAmount based on services (quantity * rate for each service)
    let totalAmount = 0;
    bill.services.forEach(item => {
      totalAmount += item.quantity * (item.rate || 0);  // Ensure we handle cases where rate might be null or 0
    });

    // Update paid amount and status (if provided)
    if (paidAmount !== undefined) {
      bill.paidAmount = paidAmount;
      bill.outstanding = totalAmount - paidAmount;  // Recalculate outstanding amount
    }

    if (status) {
      bill.status = status;
    }

    if (mode) {
      bill.mode = mode;
    }

    // Update the totalAmount and outstanding in the bill
    bill.totalAmount = totalAmount;
    bill.outstanding = totalAmount - bill.paidAmount;

    // Save the updated bill
    await bill.save();

    // Send the updated bill back in the response
    res.status(200).json({
      message: "Bill updated successfully",
      bill
    });

  } catch (error) {
    console.error("Error updating bill:", error);
    res.status(500).json({
      message: "Error updating bill.",
      error: error.message
    });
  }
};

export const addToBill = async (req, res) => {
  const { billId } = req.params;
  const { category, quantity, rate, details } = req.body;

  // Validate ObjectId format
  if (!mongoose.Types.ObjectId.isValid(billId)) {
    return res.status(400).json({ message: "Invalid Bill ID format." });
  }

  try {
    // Fetch the bill by ID
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    // Create a new expense and add it to the bill's services array
    const newExpense = {
      service: null,  // No service ID for custom expenses
      category,       // Admin-defined category
      quantity,
      rate,
      details,
    };

    // Add the new expense to the services array
    bill.services.push(newExpense);

    // Update the totalAmount and outstanding
    bill.totalAmount += rate * quantity;
    bill.outstanding = bill.totalAmount - bill.paidAmount;

    // Save the updated bill
    await bill.save();

    // Return the updated bill in the response
    res.status(200).json({
      message: "Expense added successfully.",
      bill: {
        caseId: bill.caseId,
        totalAmount: bill.totalAmount,
        services: bill.services,
        outstanding: bill.outstanding,
      },
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
