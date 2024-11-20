import Hospital from "../models/hospitalModel.js";

export const registerHospital = async (req, res) => {
  const {
    name,
    address,
    phone,
    email,
    website,
    establishedDate,
    services,
    totalRooms,
    totalStaff,
    departments
  } = req.body;

  // Check for missing fields
  if (
    !name ||
    !address ||
    !phone ||
    !email ||
    !establishedDate ||
    !services ||
    !totalRooms ||
    !totalStaff ||
    !departments
  ) {
    return res.status(400).json({ message: "All fields are required." });
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
      services,
      totalRooms,
      totalStaff,
      departments,
    //   mainAdmin, // Assuming MainAdmin is a reference to a user that exists
    //   hospitalAdmin, // Assuming HospitalAdmin is a reference to a user that exists
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
