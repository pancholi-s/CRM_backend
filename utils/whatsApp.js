import axios from "axios";

export const sendWhatsAppMessage = async ({
  to,
  patientName,
  doctorName,
  hospitalName,
  date,
  time
}) => {
  try {
    const response = await axios.post(
      `https://graph.facebook.com/v18.0/${process.env.PHONE_NUMBER_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to,
        type: "template",
        template: {
          name: "appointment_confirmation", // EXACT template name
          language: { code: "en" },
          components: [
            {
              type: "body",
              parameters: [
                { type: "text", text: patientName },
                { type: "text", text: doctorName },
                { type: "text", text: hospitalName },
                { type: "text", text: date },
                { type: "text", text: time }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ WhatsApp sent");
  } catch (error) {
    console.error("❌ WhatsApp error:", error.response?.data || error.message);
  }
};