import mongoose from 'mongoose';

const insuranceCompanySchema = new mongoose.Schema({
  id: { type: String, required: true },
  name: { type: String, required: true },
  services: [{
    serviceName: { type: String, required: true },
    categories: [
      {
        subCategoryName: { type: String, required: true },
        rateType: { type: String, required: true },
        rate: { type: Number, required: true },  // Insurance-specific rate
        effectiveDate: { type: Date, required: true },
        amenities: { type: String, default: "N/A" },
        additionaldetails: { 
          type: mongoose.Schema.Types.Mixed, // Store dynamic details for room types
          default: null
        },
      }
    ],
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
