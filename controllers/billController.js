import Bill from "../models/billModel.js";

// Create Bill
export const createBill = async (req, res) => {
  const { patientId, doctorId, services } = req.body;

  try {
    const totalAmount = services.reduce(
      (sum, item) => sum + item.price * item.quantity,
      0
    );
    const newBill = new Bill({
      patient: patientId,
      doctor: doctorId,
      services,
      totalAmount,
      createdBy: req.session.userId,
    });

    await newBill.save();
    res
      .status(201)
      .json({ message: "Bill created successfully.", bill: newBill });
  } catch (error) {
    res
      .status(500)
      .json({ message: "Error creating bill.", error: error.message });
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
