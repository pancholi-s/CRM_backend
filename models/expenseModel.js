import mongoose from 'mongoose';

const expenseSchema = new mongoose.Schema({
  expenseType: {
    type: String,
    required: true,
  },
  amount: {
    type: Number,
    required: true,
  },
  paidTo: {
    type: String,
    required: true,
  },
  details: {
    type: String,
    required: false,
  },
  date: {
    type: Date,
    default: Date.now,
  },
  hospital: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Hospital',
    required: true,
  },
});

const Expense = mongoose.model('Expense', expenseSchema);
export default Expense;
