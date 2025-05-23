import Expense from "../models/expenseModel.js";
import Hospital from "../models/hospitalModel.js";

export const addExpense = async (req, res) => {
  const session = await Expense.startSession();
  session.startTransaction();

  try {
    const hospitalId = req.session.hospitalId; // Get hospitalId from session
    const { expenseType, amount, paidTo, details, date } = req.body;

    // Validate hospital context
    if (!hospitalId) {
      return res
        .status(403)
        .json({ message: "Access denied. No hospital context found." });
    }

    // Check if hospital exists
    const hospital = await Hospital.findById(hospitalId).session(session);
    if (!hospital) {
      await session.abortTransaction();
      session.endSession();
      return res.status(404).json({ message: "Hospital not found." });
    }

    // Create new expense
    const expense = await Expense.create(
      [
        {
          expenseType,
          amount,
          paidTo,
          details,
          date,
          hospital: hospitalId,
        },
      ],
      { session }
    );

    // Update the hospital's expenses array
    await Hospital.findByIdAndUpdate(
      hospitalId,
      { $push: { expenses: expense[0]._id } }, // Push expense ID to hospital's expenses array
      { session, new: true }
    );

    await session.commitTransaction();
    session.endSession();

    res
      .status(201)
      .json({ message: "Expense added successfully", expense: expense[0] });
  } catch (error) {
    await session.abortTransaction();
    session.endSession();
    console.error("Error adding expense:", error);
    res
      .status(500)
      .json({ message: "Failed to add expense.", error: error.message });
  }
};

export const getExpenses = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId; // Get hospitalId from session
    const { page = 1, limit = 10 } = req.query;
    const skip = (page - 1) * limit;

    // Validate hospital context
    if (!hospitalId) {
      return res
        .status(403)
        .json({ message: "Access denied. No hospital context found." });
    }

    // Fetch expenses based on hospital context
    const total = await Expense.countDocuments({ hospital: hospitalId });
    const expenses = await Expense.find({ hospital: hospitalId })
      .sort({ date: -1 }) // Sort by latest first
      .select("-__v") // Exclude version field
      .skip(skip)
      .limit(parseInt(limit));

    res.status(200).json({
      message: "Expenses retrieved successfully.",
      hospitalId: hospitalId,
      count: expenses.length,
      totalExpenses: total,
      totalPages: Math.ceil(total / limit),
      currentPage: parseInt(page),
      expenses,
    });
  } catch (error) {
    console.error("Error fetching expenses:", error);
    res
      .status(500)
      .json({ message: "Failed to fetch expenses.", error: error.message });
  }
};
