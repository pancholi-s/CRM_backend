import OpenAI from "openai";
import dotenv from "dotenv";

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const parseAIResponse = (text) => {
  const data = {
    problemStatement: "",
    icdCode: "",
    therapyPlan: "",
    medications: [],
    injectionsTherapies: [],
    nonDrugRecommendations: [],
    precautions: "",
    lifestyleDiet: [],
    followUp: "",
    followUpInstructions: {
      reviewDate: "",
      notes: "",
    },
  };

  let currentSection = null;
  const lines = text.split("\n");

  for (let line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    if (/^1\.|^Problem Statement:/i.test(trimmed)) {
      currentSection = "problemStatement";
      continue;
    } else if (/^2\.|^ICD Code:/i.test(trimmed)) {
      currentSection = "icdCode";
      continue;
    } else if (/^3\.|^Therapy Plan:/i.test(trimmed)) {
      currentSection = "therapyPlan";
      continue;
    } else if (/^4\.|^Medications:/i.test(trimmed)) {
      currentSection = "medications";
      continue;
    } else if (/^5\.|^Injections.*Therapies:/i.test(trimmed)) {
      currentSection = "injectionsTherapies";
      continue;
    } else if (/^6\.|^Non-Drug Recommendations:/i.test(trimmed)) {
      currentSection = "nonDrugRecommendations";
      continue;
    } else if (/^7\.|^Precautions:/i.test(trimmed)) {
      currentSection = "precautions";
      continue;
    } else if (/^8\.|^Lifestyle.*Diet:/i.test(trimmed)) {
      currentSection = "lifestyleDiet";
      continue;
    } else if (
      /^9\.|^Follow-Up:/i.test(trimmed) &&
      !/Instructions/i.test(trimmed)
    ) {
      currentSection = "followUp";
      continue;
    } else if (/^10\.|^Follow-Up Instructions:/i.test(trimmed)) {
      currentSection = "followUpInstructions";
      continue;
    }

    if (!currentSection) continue;

    if (
      [
        "medications",
        "injectionsTherapies",
        "nonDrugRecommendations",
        "lifestyleDiet",
      ].includes(currentSection)
    ) {
      if (/^[-•*]\s*/.test(trimmed)) {
        const item = trimmed.replace(/^[-•*]\s*/, "").trim();
        if (item) {
          data[currentSection].push(item);
        }
      }
    } else if (currentSection === "followUpInstructions") {
      if (/Review Date:/i.test(trimmed)) {
        data.followUpInstructions.reviewDate = trimmed
          .replace(/^[-•*]?\s*Review Date:\s*/i, "")
          .trim();
      } else if (/Notes:/i.test(trimmed)) {
        data.followUpInstructions.notes = trimmed
          .replace(/^[-•*]?\s*Notes:\s*/i, "")
          .trim();
      }
    } else {
      const content = trimmed.replace(/^[-•*]\s*/, "").trim();
      if (content) {
        data[currentSection] += (data[currentSection] ? " " : "") + content;
      }
    }
  }

  return data;
};

// export const generateAIPrescription = async (inputData) => {
//   let patientInfo = "";

//   if (inputData.medicalHistory) {
//     patientInfo += `Medical History: ${JSON.stringify(
//       inputData.medicalHistory,
//       null,
//       2
//     )}\n\n`;
//   }

//   if (inputData.diagnosisVitals) {
//     patientInfo += `Diagnosis & Vitals: ${JSON.stringify(
//       inputData.diagnosisVitals,
//       null,
//       2
//     )}\n\n`;
//   }

//   Object.entries(inputData).forEach(([key, value]) => {
//     if (!["medicalHistory", "diagnosisVitals"].includes(key) && value) {
//       patientInfo += `${key}: ${JSON.stringify(value, null, 2)}\n\n`;
//     }
//   });

//   const prompt = `You are a clinical AI assistant. Generate a structured prescription based on patient data.

// RULES:
// - Be concise (1-3 lines per section)
// - Use bullet points with dash (-) for lists
// - Be medically accurate and realistic
// - NEVER skip any section - ALL sections must have content
// - For Medications: Always suggest at least 2-3 relevant medications
// - For Injections/Therapies: Suggest at least 1-2 if clinically appropriate (Vitamin B12, physiotherapy, etc.)
// - For Non-Drug Recommendations: Always include 2-3 recommendations
// - For Lifestyle & Diet: Always include 3-4 specific dietary/lifestyle changes

// Generate ALL 11 sections with these EXACT headers:

// 1. Problem Statement:
// 2. ICD Code:
// 3. Therapy Plan:
// 4. Medications:
// 5. Injections / Therapies:
// 6. Non-Drug Recommendations:
// 7. Precautions:
// 8. Lifestyle & Diet:
// 9. Follow-Up:
// 10. Follow-Up Instructions:
//    - Review Date: [specific date like "15-November-2025"]
//    - Notes: [specific notes about what to bring or monitor]

// PATIENT DATA:
// ${patientInfo}

// Generate structured prescription now:`;

//   const response = await openai.chat.completions.create({
//     model: "gpt-4",
//     messages: [{ role: "user", content: prompt }],
//     temperature: 0.3,
//     max_tokens: 1500,
//   });

//   const text = response?.choices?.[0]?.message?.content?.trim();

//   if (!text || text.length < 10) {
//     throw new Error("AI returned empty response");
//   }

//   return parseAIResponse(text);
// };

export const generateAIPrescription = async (inputData) => {
  let patientInfo = "";
  let allImageUrls = [];

  const extractImages = (obj) => {
    if (!obj || typeof obj !== "object") return;

    for (const [key, value] of Object.entries(obj)) {
      if (Array.isArray(value)) {
        value.forEach((item) => {
          if (typeof item === "string" && isImageUrl(item)) {
            allImageUrls.push(item);
          }
        });
      } else if (typeof value === "string" && isImageUrl(value)) {
        allImageUrls.push(value);
      }
    }
  };

  const isImageUrl = (str) => {
    if (!str || typeof str !== "string") return false;

    if (
      str.startsWith("http://") ||
      str.startsWith("https://") ||
      str.startsWith("data:image/")
    ) {
      return true;
    }

    const imageExtensions = [
      ".jpg",
      ".jpeg",
      ".png",
      ".gif",
      ".bmp",
      ".webp",
      ".svg",
    ];
    return imageExtensions.some((ext) => str.toLowerCase().includes(ext));
  };

  if (inputData.medicalHistory) {
    extractImages(inputData.medicalHistory);
    patientInfo += `Medical History: ${JSON.stringify(
      inputData.medicalHistory,
      null,
      2
    )}\n\n`;
  }

  if (inputData.diagnosisVitals) {
    extractImages(inputData.diagnosisVitals);
    patientInfo += `Diagnosis & Vitals: ${JSON.stringify(
      inputData.diagnosisVitals,
      null,
      2
    )}\n\n`;
  }

  Object.entries(inputData).forEach(([key, value]) => {
    if (!["medicalHistory", "diagnosisVitals"].includes(key) && value) {
      if (typeof value === "object") {
        extractImages(value);
      }
      patientInfo += `${key}: ${JSON.stringify(value, null, 2)}\n\n`;
    }
  });

  const prompt = `You are a clinical AI assistant. Generate a structured prescription based on patient data.

${
  allImageUrls.length > 0
    ? "IMPORTANT: Analyze the provided medical images (X-rays, CT scans, lab reports, etc.) along with the text data to generate an accurate prescription.\n"
    : ""
}

RULES:
- Be concise (1-3 lines per section)
- Use bullet points with dash (-) for lists
- Be medically accurate and realistic
- NEVER skip any section - ALL sections must have content
- For Medications: Always suggest at least 2-3 relevant medications
- For Injections/Therapies: Suggest at least 1-2 if clinically appropriate (Vitamin B12, physiotherapy, etc.)
- For Non-Drug Recommendations: Always include 2-3 recommendations
- For Lifestyle & Diet: Always include 3-4 specific dietary/lifestyle changes

Generate ALL 11 sections with these EXACT headers:

1. Problem Statement:
2. ICD Code:
3. Therapy Plan:
4. Medications:
5. Injections / Therapies:
6. Non-Drug Recommendations:
7. Precautions:
8. Lifestyle & Diet:
9. Follow-Up:
10. Follow-Up Instructions:
   - Review Date: [specific date like "15-November-2025"]
   - Notes: [specific notes about what to bring or monitor]

PATIENT DATA:
${patientInfo}

Generate structured prescription now:`;

  const messageContent = [{ type: "text", text: prompt }];

  if (allImageUrls.length > 0) {
    allImageUrls.forEach((imageUrl) => {
      if (imageUrl) {
        messageContent.push({
          type: "image_url",
          image_url: {
            url: imageUrl,
          },
        });
      }
    });
  }

  const response = await openai.chat.completions.create({
    model: allImageUrls.length > 0 ? "gpt-4o" : "gpt-4",
    messages: [
      {
        role: "user",
        content: messageContent,
      },
    ],
    temperature: 0.3,
    max_tokens: 1500,
  });

  const text = response?.choices?.[0]?.message?.content?.trim();

  if (!text || text.length < 10) {
    throw new Error("AI returned empty response");
  }

  return parseAIResponse(text);
};
