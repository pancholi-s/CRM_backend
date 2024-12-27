import Bill from "../models/billModel.js";
import Appointment from "../models/appointmentModel.js";
import Service from "../models/serviceModel.js";

// Create Bill with Service Validation
export const createBill = async (req, res) => {
  const { appointmentId, services } = req.body;

  const { hospitalId } = req.session; // Retrieve hospital and user context from session

  if (!hospitalId) {
    return res
      .status(403)
      .json({ message: "Access denied. No hospital context found." });
  }

  try {
    // 1. Validate Appointment
    const appointment = await Appointment.findById(appointmentId)
      .populate("patient", "name email phone")
      .populate("doctor", "name email specialization");

    if (!appointment) {
      return res.status(404).json({ message: "Appointment not found." });
    }

    if (appointment.status !== "Completed") {
      return res.status(400).json({ message: "Appointment is not completed yet." });
    }

    // 2. Validate Services
    let totalAmount = 0;
    const validatedServices = [];

    for (const serviceItem of services) {
      const service = await Service.findOne({
        _id: serviceItem.serviceId,
        createdBy: hospitalId, // Ensures the service belongs to the hospital
      });

      if (!service) {
        return res.status(404).json({ message: `Service not found: ${serviceItem.serviceId}` });
      }

      // Calculate price and add to validated services
      const serviceTotal = service.price * serviceItem.quantity;
      validatedServices.push({
        service: service._id,
        quantity: serviceItem.quantity,
      });
      totalAmount += serviceTotal;
    }

    // 3. Create Bill
    const newBill = new Bill({
      patient: appointment.patient._id,
      doctor: appointment.doctor._id,
      services: validatedServices,
      totalAmount,
      createdBy: hospitalId, // Fixed: Use hospital ID for createdBy
    });

    // Save the bill
    await newBill.save();

    res.status(201).json({ message: "Bill generated successfully.", bill: newBill });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error generating bill.", error: error.message });
  }
};

// Get Bill Details
export const getBillDetails = async (req, res) => {
  const { billId } = req.params;

  try {
    const bill = await Bill.findById(billId)
      .populate("patient", "name phone")
      .populate("doctor", "name specialization")
      .populate("services.service", "name price")
      .populate({
        path: "patient",
        populate: { path: "appointments", select: "caseId tokenDate" },
      });

    if (!bill) {
      return res.status(404).json({ message: "Bill not found." });
    }

    const caseId = bill.patient.appointments?.[0]?.caseId || "N/A";
    const date = bill.patient.appointments?.[0]?.tokenDate || "N/A";

    const services = bill.services.map((item) => ({
      name: item.service.name,
      price: item.service.price,
      quantity: item.quantity,
      total: item.service.price * item.quantity,
    }));

    const totalAmount = services.reduce(
      (sum, service) => sum + service.total,
      0
    );
    const paid = bill.totalAmount;
    const outstanding = totalAmount - paid;

    res.status(200).json({
      invoiceNumber: `INV${bill._id.toString().slice(-6)}`,
      caseId,
      patient: { name: bill.patient.name, phone: bill.patient.phone },
      doctor: {
        name: bill.doctor.name,
        specialization: bill.doctor.specialization,
      },
      date: new Date(date).toLocaleDateString(),
      services,
      totalAmount,
      paid,
      outstanding,
      status: bill.status,
    });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error fetching bill details.", error: error.message });
  }
};
