import Bill from "../models/billModel.js";
import Appointment from "../models/appointmentModel.js";
import Service from "../models/serviceModel.js";

// Create Bill with Dynamic Service Details
export const createBill = async (req, res) => {
  const { appointmentId, services, paidAmount, mode } = req.body;
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Access denied. No hospital context found." });
  }

  try {
    // Fetch appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "name phone")
      .populate("doctor", "name specialization");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (appointment.status !== "Completed") {
      return res
        .status(400)
        .json({ message: "Appointment is not completed yet." });
    }

    // Validate services
    let totalAmount = 0;
    const validatedServices = [];

    for (const serviceItem of services) {
      const service = await Service.findOne({
        _id: serviceItem.serviceId,
        createdBy: hospitalId,
      });

      if (!service) {
        return res
          .status(404)
          .json({ message: `Service not found: ${serviceItem.serviceId}` });
      }

      // Find sub-category details
      const serviceDetails = service.categories.find(
        (sub) => sub.category === serviceItem.category
      );

      if (!serviceDetails) {
        return res
          .status(404)
          .json({ message: `Sub-category not found: ${serviceItem.category}` });
      }

      const serviceTotal = serviceDetails.rate * serviceItem.quantity;
      validatedServices.push({
        service: service._id,
        quantity: serviceItem.quantity,
      });
      totalAmount += serviceTotal;
    }

    const outstanding = totalAmount - paidAmount;

    // Create Bill
    const newBill = new Bill({
      caseId: appointment.caseId,
      patient: appointment.patient._id,
      doctor: appointment.doctor._id,
      services: validatedServices,
      totalAmount,
      paidAmount,
      outstanding,
      status: outstanding === 0 ? "Paid" : "Pending",
      mode,
      createdBy: hospitalId,
      invoiceNumber: `INV${Date.now().toString().slice(-6)}`,
    });

    await newBill.save();

    res
      .status(201)
      .json({ message: "Bill generated successfully.", bill: newBill });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error generating bill.", error: error.message });
  }
};

// Get All Bills
export const getAllBills = async (req, res) => {
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Access denied. No hospital context found." });
  }

  try {
    const bills = await Bill.find({ createdBy: hospitalId })
      .populate("patient", "name phone")
      .populate("doctor", "name specialization")
      .populate("services.service", "name")
      .sort({ createdAt: -1 });

    res.status(200).json({ count: bills.length, bills });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching bills.", error: error.message });
  }
};

// Get Bill Details
export const getBillDetails = async (req, res) => {
  const { billId } = req.params;

  try {
    const bill = await Bill.findById(billId)
      .populate("patient", "name phone")
      .populate("doctor", "name specialization")
      .populate("services.service", "name rateType rate");

    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    const services = bill.services.map((item) => ({
      name: item.service.name,
      category: item.service.category,
      rateType: item.service.rateType,
      rate: item.service.rate,
      quantity: item.quantity,
      total: item.service.rate * item.quantity,
    }));

    res.status(200).json({
      invoiceNumber: bill.invoiceNumber,
      caseId: bill.caseId,
      invoiceDate: bill.invoiceDate,
      patient: { name: bill.patient.name, phone: bill.patient.phone },
      doctor: {
        name: bill.doctor.name,
        specialization: bill.doctor.specialization,
      },
      services,
      totalAmount: bill.totalAmount,
      paidAmount: bill.paidAmount,
      outstanding: bill.outstanding,
      status: bill.status,
      mode: bill.mode,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching bill details.", error: error.message });
  }
};
