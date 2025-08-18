import mongoose from 'mongoose';

const insuranceCompanySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  services: [{
    serviceName: { type: String, required: true },
    pricingDetails: { 
      type: mongoose.Schema.Types.Mixed, // Flexible pricing details (object) 
      required: true
    }
  }],
  hospitalId: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'Hospital', 
    required: true 
  },
  createdBy: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
}, { timestamps: true });

const InsuranceCompany = mongoose.model('InsuranceCompany', insuranceCompanySchema);

export default InsuranceCompany;
