import mongoose from "mongoose";

const newPrescriptionSchema = new mongoose.Schema(
  {
    doctor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Doctor",
      required: true,
    },
    patient: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Patient",
      required: true,
    },
    hospital: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Hospital",
      required: true,
    },

    aiPrescription: {
      problemStatement: {
        type: String,
        default: "",
      },
      icdCode: {
        type: String,
        default: "",
      },
      therapyPlan: {
        type: String,
        default: "",
      },
      medications: {
        type: [String],
        default: [],
      },
      injectionsTherapies: {
        type: [String],
        default: [],
      },
      nonDrugRecommendations: {
        type: [String],
        default: [],
      },
      precautions: {
        type: String,
        default: "",
      },
      lifestyleDiet: {
        type: [String],
        default: [],
      },
      followUp: {
        type: String,
        default: "",
      },
      followUpInstructions: {
        reviewDate: {
          type: String,
          default: "",
        },
        notes: {
          type: String,
          default: "",
        },
      },
    },

    inputData: {
      type: Object,
      required: true,
    },

    approved: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  }
);

export default mongoose.model("NewPrescription", newPrescriptionSchema);
