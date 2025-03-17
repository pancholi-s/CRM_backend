import Hospital from "../models/hospitalModel.js";

export const registerHospital = async (req, res) => {
  const {
    name,
    address,
    phone,
    email,
    website,
    establishedDate,
    departments,
    administrativeDetails,
    licenses,
    nabhAccreditation,
    description
  } = req.body;

  // Check for required fields
  if (!name || !address || !phone || !email ) {
    return res.status(400).json({ message: "Required fields are missing." });
  }

  try {
    // Check if the hospital name or phone number already exists
    const existingHospital = await Hospital.findOne({ $or: [{ name }, { phone }] });
    if (existingHospital) {
      return res.status(400).json({ message: "Hospital with this name or phone already exists." });
    }

    // Create a new hospital object
    const newHospital = new Hospital({
      name,
      address,
      phone,
      email,
      website,
      establishedDate,
      departments,
      administrativeDetails,  // Optional
      licenses,  // Optional
      nabhAccreditation,  // Optional
      description  // Optional
    });

    // Save the hospital to the database
    await newHospital.save();

    res.status(201).json({
      message: "Hospital registered successfully.",
      hospital: newHospital,
    });
  } catch (error) {
    console.error("Error registering hospital:", error);
    res.status(500).json({ message: "Error registering hospital." });
  }
};
