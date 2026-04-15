//middelware
import Integration from "../models/integrationModel.js";

export const integrationAuth = async (req, res, next) => {
  try {
    const apiKey = req.headers["x-api-key"];
    const hospitalId = req.headers["x-hospital-id"];

    // 👉 normal user flow
    if (!apiKey) return next();

    console.log("API KEY:", apiKey);
    console.log("INTEGRATION HIT");

    const integration = await Integration.findOne({
      apiKey,
      status: "active",
    });

    if (!integration) {
      return res.status(403).json({ message: "Invalid API key" });
    }

    if (
      integration.accessType === "restricted" &&
      !integration.hospitals.includes(hospitalId)
    ) {
      return res.status(403).json({ message: "Hospital access denied" });
    }

    // 🔥 Inject user (IMPORTANT)
    req.isIntegration = true;

    req.user = {
      _id: "system",
      role: "integration",
      hospital: hospitalId,
      hospitalId: hospitalId,
    };

        // 🔥 THIS IS THE MISSING PART (VERY IMPORTANT)
    if (!req.session) req.session = {};
    req.session.hospitalId = hospitalId;

    next();
  } catch (err) {
    console.error("Integration auth error:", err);
    res.status(500).json({ message: "Integration auth failed" });
  }
};