import Hospital from "../models/hospitalModel.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";
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
    description,
  } = req.body;

  // Check for required fields
  if (!name || !address || !phone || !email) {
    return res.status(400).json({ message: "Required fields are missing." });
  }

  try {
    // Check if the hospital name or phone number already exists
    const existingHospital = await Hospital.findOne({
      $or: [{ name }, { phone }],
    });
    if (existingHospital) {
      return res
        .status(400)
        .json({ message: "Hospital with this name or phone already exists." });
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
      administrativeDetails, // Optional
      licenses, // Optional
      nabhAccreditation, // Optional
      description, // Optional
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

export const addHospitalImage = async (req, res) => {
  try {
    const { hospitalId } = req.body;

    if (!hospitalId || !req.file) {
      return res.status(400).json({
        message: "hospitalId and image file are required.",
      });
    }

    const cloudinaryResult = await uploadToCloudinary(
      req.file.buffer,
      req.file.originalname,
      req.file.mimetype
    );

    const updatedHospital = await Hospital.findByIdAndUpdate(
      hospitalId,
      {
        hospitalImage: cloudinaryResult.secure_url,
        hospitalImagePublicId: cloudinaryResult.public_id,
      },
      { new: true }
    );

    if (!updatedHospital) {
      return res.status(404).json({ message: "Hospital not found." });
    }

    res.status(200).json({
      message: "Hospital image updated successfully.",
      hospital: {
        _id: updatedHospital._id,
        name: updatedHospital.name,
        hospitalImage: updatedHospital.hospitalImage,
      },
    });
  } catch (error) {
    console.error("Error updating hospital image:", error);
    res.status(500).json({ message: "Error updating hospital image." });
  }
};
