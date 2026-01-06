import mongoose from "mongoose";

import Appointment from "../models/appointmentModel.js";
import Bill from "../models/billModel.js";
import Patient from "../models/patientModel.js";
import Service from "../models/serviceModel.js";
import Hospital from "../models/hospitalModel.js";
import EstimatedBill from "../models/estimatedBillModel.js";
import AdmissionRequest from '../models/admissionReqModel.js';
import Department from "../models/departmentModel.js";

export const createBill = async (req, res) => {
  const { patientId, caseID, services, paidAmount = 0, mode, departmentId } = req.body;
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({
      error: "Access denied. No hospital context found."
    });
  }

  try {
    // 1️⃣ Fetch patient
    const patient = await Patient.findOne({
      _id: patientId,
      hospital: hospitalId,
    }).select("name phone");

    if (!patient) {
      return res.status(404).json({ error: "Patient not found." });
    }

    // 2️⃣ Validate appointment (caseId)
    const appointment = await Appointment.findOne({
      caseId: caseID,
      patient: patientId,
      hospital: hospitalId,
    });

    if (!appointment) {
      return res.status(404).json({ error: "Appointment not found." });
    }

    // 3️⃣ Department-aware rate lookup helper
    const getDepartmentRate = (serviceDoc, subCategoryName, departmentId) => {
      if (!serviceDoc || !Array.isArray(serviceDoc.categories)) return 0;

      // Department-specific rate
      const deptSpecific = serviceDoc.categories.find(
        (cat) =>
          cat.subCategoryName === subCategoryName &&
          cat.departments?.some(
            (dep) => dep.toString() === departmentId?.toString()
          )
      );

      // Fallback rate
      const fallback = serviceDoc.categories.find(
        (cat) => cat.subCategoryName === subCategoryName
      );

      return deptSpecific?.rate || fallback?.rate || 0;
    };

    // 4️⃣ Validate services & calculate GROSS amount
    let grossAmount = 0;
    const validatedServices = [];

    for (const serviceItem of services) {
      const service = await Service.findOne({
        _id: serviceItem.serviceId,
        hospital: hospitalId,
      });

      if (!service) {
        return res.status(404).json({
          error: `Service not found: ${serviceItem.serviceId}`,
        });
      }

      const rate = getDepartmentRate(
        service,
        serviceItem.category,
        serviceItem.departmentId || departmentId
      );

      if (!rate) {
        return res.status(400).json({
          error: `Rate not found for category '${serviceItem.category}' in selected department.`,
        });
      }

      const serviceTotal = rate * serviceItem.quantity;

      validatedServices.push({
        service: service._id,
        category: serviceItem.category,
        quantity: serviceItem.quantity,
        rate,
        total: serviceTotal,
        details: {
          department: serviceItem.departmentId || departmentId || null,
        },
      });

      grossAmount += serviceTotal;
    }

    // 5️⃣ Discount-ready amounts (NO discount applied yet)
    const netAmount = grossAmount; // 👈 important
    const outstanding = netAmount - paidAmount;

    // 6️⃣ Create bill
    const newBill = new Bill({
      patient: patient._id,
      caseId: appointment.caseId,
      services: validatedServices,

      // 💰 Amounts
      grossAmount,
      netAmount,
      totalAmount: netAmount, // 🔒 backward compatibility
      paidAmount,
      outstanding,

      status: outstanding <= 0 ? "Paid" : "Pending",
      mode,
      hospital: hospitalId,
      invoiceNumber: `INV${Date.now().toString().slice(-6)}`,
    });

    await newBill.save();

    // 7️⃣ Update hospital revenue (only paid amount)
    if (paidAmount > 0) {
      await Hospital.updateOne(
        { _id: hospitalId },
        { $inc: { revenue: paidAmount } }
      );
    }

    // 8️⃣ Response
    return res.status(201).json({
      success: true,
      message: "Bill created successfully.",
      bill: newBill,
    });

  } catch (error) {
    console.error("❌ Error creating bill:", error);
    return res.status(500).json({
      error: `Error generating bill: ${error.message}`,
    });
  }
};



export const getAllBills = async (req, res) => {
  const { hospitalId } = req.session;
  const { page = 1, limit = 10, search = "" } = req.query;
  const skip = (page - 1) * limit;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Access denied. No hospital context found." });
  }

  try {
    let filter = { hospital: hospitalId };

    // 🔎 Optional search
    if (search) {
      const matchingPatients = await Patient.find({
        name: { $regex: search, $options: "i" },
      }).select("_id");

      const patientIds = matchingPatients.map((p) => p._id);

      filter.$or = [
        { caseId: { $regex: search, $options: "i" } },
        { invoiceNumber: { $regex: search, $options: "i" } },
        { status: { $regex: search, $options: "i" } },
        { patient: { $in: patientIds } },
      ];
    }

    const total = await Bill.countDocuments(filter);

    const bills = await Bill.find(filter)
      .populate("patient", "name phone")
      .populate("doctor", "name specialization")
      .populate({
        path: "services.service",
        populate: {
          path: "categories.departments",
          select: "name",
        },
        select: "name categories",
      })
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    // ✅ Collect all department IDs used in bills
    const departmentIds = [
      ...new Set(
        bills
          .flatMap((bill) =>
            bill.services.map((s) => s.details?.department).filter(Boolean)
          )
      ),
    ];

    // ✅ Fetch department names once
    const departments = await Department.find({
      _id: { $in: departmentIds },
    }).select("name");

    const departmentMap = {};
    departments.forEach((dept) => {
      departmentMap[dept._id.toString()] = dept.name;
    });

    // 🧾 Format response with department names injected
    const formattedBills = bills.map((bill) => ({
      _id: bill._id,
      caseId: bill.caseId,
      patient: bill.patient,
      doctor: bill.doctor,
      services: bill.services.map((service) => {
        const serviceDoc = service.service || {};
        const category = serviceDoc?.categories?.find(
          (c) => c.subCategoryName === service.category
        );

        const departmentNames =
          category?.departments?.map((d) => d.name).join(", ") || "N/A";

        const deptId = service.details?.department;
        const deptName = deptId
          ? departmentMap[deptId.toString()] || "Unknown"
          : "N/A";

        return {
          service: serviceDoc?.name || "Unknown Service",
          category: service.category,
          quantity: service.quantity,
          rate: service.rate,
          total: service.rate * service.quantity,
          departments: departmentNames, // from service model
          details: {
            ...service.details,
            department: { _id: deptId, name: deptName }, // ✅ inject department name
          },
        };
      }),
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      outstanding: bill.outstanding,
      status: bill.status,
      invoiceNumber: bill.invoiceNumber,
      invoiceDate: bill.invoiceDate,
      mode: bill.mode,
      createdAt: bill.createdAt,
      updatedAt: bill.updatedAt,
    }));

    res.status(200).json({
      count: formattedBills.length,
      totalBills: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      bills: formattedBills,
    });
  } catch (error) {
    console.error("Error fetching bills:", error);
    res
      .status(500)
      .json({ message: "Error fetching bills.", error: error.message });
  }
};



export const getBillDetails = async (req, res) => {
  const { billId } = req.params;

  try {
    const bill = await Bill.findById(billId)
      .populate("patient", "name phone patId")
      .populate("doctor", "name specialization")
      .populate({
        path: "services.service",
        populate: {
          path: "categories.departments",
          select: "name"
        },
        select: "name categories"
      });

    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    const admissionRequest = await AdmissionRequest.findOne({ caseId: bill.caseId });
    const insurance = admissionRequest?.admissionDetails?.insurance || "N/A";

    // ✅ Collect all department IDs used in this bill
    const departmentIds = [
      ...new Set(
        bill.services
          .map((s) => s.details?.department)
          .filter(Boolean)
      ),
    ];

    // ✅ Fetch department names once
    const departments = await Department.find({
      _id: { $in: departmentIds },
    }).select("name");

    const departmentMap = {};
    departments.forEach((dept) => {
      departmentMap[dept._id.toString()] = dept.name;
    });

    // 🧩 Build detailed service info with department support
    const services = bill.services.map((item) => {
      const serviceDoc = item.service;
      const baseDetails = item.details || {};

      if (!serviceDoc) {
        return {
          serviceId: null,
          service: "Unknown Service",
          category: item.category,
          quantity: item.quantity,
          rate: item.rate,
          details: baseDetails,
        };
      }

      const categories = serviceDoc.categories || [];
      const category = categories.find(
        (c) => c.subCategoryName === item.category
      ) || {};

      const departmentsFromCategory =
        category.departments?.map((dep) => dep.name).join(", ") || "N/A";

      // ✅ Inject department name from map (if exists)
      const deptId = baseDetails?.department;
      const deptName = deptId
        ? departmentMap[deptId.toString()] || "Unknown"
        : "N/A";

      return {
        serviceId: serviceDoc._id,
        service: serviceDoc.name || "Unknown Service",
        category: item.category || "Unknown Category",
        quantity: item.quantity || 1,
        rate: item.rate || 0,
        details: {
          ...baseDetails,
          department: deptId
            ? { _id: deptId, name: deptName }
            : { _id: null, name: "N/A" }, // ✅ full object
          rateType: category.rateType || "Unknown",
          effectiveDate: category.effectiveDate || null,
          departments: departmentsFromCategory,
        },
      };
    });

    res.status(200).json({
      invoiceNumber: bill.invoiceNumber,
      caseId: bill.caseId,
      invoiceDate: bill.invoiceDate,
      patient: bill.patient
        ? {
            name: bill.patient.name,
            phone: bill.patient.phone,
            patId: bill.patient.patId,
          }
        : { name: "Unknown", phone: "N/A" },
      doctor: bill.doctor
        ? {
            name: bill.doctor.name,
            specialization: bill.doctor.specialization,
          }
        : { name: "Unknown", specialization: "N/A" },
      insurance,
      deposit: bill.deposit,
      services,
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      outstanding: bill.outstanding,
      status: bill.status,
      mode: bill.mode,
      payments: bill.payments || [],
    });
  } catch (error) {
    console.error("Error fetching bill details:", error);
    res
      .status(500)
      .json({ message: "Error fetching bill details.", error: error.message });
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
  const { services, paidAmount, mode } = req.body; // remove status from frontend input

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

    // Recalculate total
    bill.totalAmount = bill.services.reduce(
      (sum, item) => sum + (item.quantity || 1) * (item.rate || 0),
      0
    );

    // Update paid amount if provided
    if (paidAmount !== undefined) {
      bill.paidAmount = paidAmount;
    }

    // Recalculate outstanding
    bill.outstanding = bill.totalAmount - bill.paidAmount;

    // Auto-update status based on outstanding
    bill.status = bill.outstanding <= 0 ? "Paid" : "Pending";

    // Update mode if provided
    if (mode) bill.mode = mode;

    await bill.save();

    const updatedBill = await Bill.findById(billId)
      .populate("patient", "name phone email patId")
      .populate("doctor", "name specialization")
      .populate("services.service", "name description categories");

    res.status(200).json({
      message: "Bill updated successfully",
      bill: updatedBill.toObject(),
    });
  } catch (error) {
    console.error("Error updating bill:", error);
    res.status(500).json({ message: "Error updating bill.", error: error.message });
  }
};


export const addToBill = async (req, res) => {
  const { billId } = req.params;
  const { category, quantity, rate, details, date } = req.body; // Accept date from the body

  if (!mongoose.Types.ObjectId.isValid(billId)) {
    return res.status(400).json({ message: "Invalid Bill ID format." });
  }

  try {
    const bill = await Bill.findById(billId);
    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    // If date is not provided, use the current date (today's date)
    const billedDateStr = date || new Date().toISOString().split("T")[0];

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
        name: details,
        daysOccupied: 1,
        totalCharge: rate * quantity,
        billedDate: billedDateStr, // Use the provided date or current date
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
    const { admissionRequestId, grandTotal, categories } = req.body;  // date is inside each item, no need for global date field
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) return res.status(403).json({ message: "No hospital context." });

    const admissionRequest = await AdmissionRequest.findById(admissionRequestId).populate("patient");
    if (!admissionRequest) {
      return res.status(404).json({ message: "Admission request not found." });
    }

    // Create a new estimated bill with the provided categories
    const newEstimate = new EstimatedBill({
      admissionRequest: admissionRequest._id,
      hospital: hospitalId,
      grandTotal,
      categories: categories.map(category => ({
        ...category,  // spread existing category data
        items: category.items.map(item => ({
          ...item,      // spread existing item data
          date: item.date || new Date().toISOString().split("T")[0] // Set default date if not provided
        }))
      })),
      date: new Date().toISOString().split("T")[0] // You can set this to the current date
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


export const applyDiscount = async (req, res) => {
  const { billId } = req.params;
  const { type, value, reason } = req.body;

  const bill = await Bill.findById(billId);
  if (!bill) return res.status(404).json({ message: "Bill not found" });

  const gross = bill.grossAmount || bill.totalAmount;

  let discountAmount = 0;

  if (type === "Percentage") {
    discountAmount = (gross * value) / 100;
  } else if (type === "Flat") {
    discountAmount = value;
  }

  // ❗ Guardrails
  if (discountAmount < 0) discountAmount = 0;
  if (discountAmount > gross) discountAmount = gross;

  bill.discount = {
    type,
    value,
    amount: discountAmount,
    reason,
    appliedBy: req.user?._id,
    appliedAt: new Date()
  };

  bill.netAmount = gross - discountAmount;
  bill.totalAmount = bill.netAmount; // keep old code safe
  bill.outstanding = bill.netAmount - bill.paidAmount;

  // auto status update
  bill.status = bill.outstanding <= 0 ? "Paid" : "Pending";

  await bill.save();

  res.status(200).json({
    message: "Discount applied successfully",
    bill
  });
};
