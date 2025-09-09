import mongoose from "mongoose";
import File from "../models/patientFileModel.js";
import { uploadToCloudinary } from "../utils/cloudinary.js";

export const uploadFiles = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context missing" });
    }

    const { patientId } = req.body;

    if (!patientId) {
      return res.status(400).json({ message: "Patient ID is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patient ID" });
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({
        success: false,
        message: "No files provided",
      });
    }

    const uploadPromises = req.files.map(async (file) => {
      try {
        const result = await uploadToCloudinary(
          file.buffer,
          file.originalname,
          file.mimetype
        );

        const fileData = new File({
          filename: result.public_id,
          originalName: file.originalname,
          url: result.secure_url,
          publicId: result.public_id,
          fileType: file.mimetype,
          fileSize: file.size,
          resourceType: result.resource_type,
          folder: "crm_uploads",
          hospital: hospitalId,
          patient: patientId,
          uploadedBy: {
            userId: req.user._id,
            role: req.user.role,
          },
        });

        const savedFile = await fileData.save();

        return {
          id: savedFile._id,
          filename: savedFile.originalName,
          url: savedFile.url,
          fileType: savedFile.fileType,
          fileSize: savedFile.fileSize,
          resourceType: savedFile.resourceType,
          uploadedAt: savedFile.uploadedAt,
        };
      } catch (error) {
        console.error(`Error uploading file ${file.originalname}:`, error);
        throw error;
      }
    });

    const uploadedFiles = await Promise.all(uploadPromises);

    res.status(200).json({
      success: true,
      message: `Successfully uploaded ${uploadedFiles.length} file(s)`,
      data: uploadedFiles,
      count: uploadedFiles.length,
    });
  } catch (error) {
    console.error("Upload controller error:", error);
    res.status(500).json({
      success: false,
      message: "File upload failed",
      error: error.message,
    });
  }
};

export const getAllFiles = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context missing" });
    }

    const page = Math.max(parseInt(req.query.page) || 1, 1);
    const limit = Math.min(Math.max(parseInt(req.query.limit) || 10, 1), 100);
    const skip = (page - 1) * limit;

    const files = await File.find({ hospital: hospitalId })
      .populate("patient", "name email phone")
      .sort({ uploadedAt: -1 })
      .skip(skip)
      .limit(limit)
      .select("-__v")
      .lean();

    const totalFiles = await File.countDocuments({ hospital: hospitalId });
    const totalPages = Math.ceil(totalFiles / limit);

    res.status(200).json({
      success: true,
      message: "Files retrieved successfully",
      data: files,
      pagination: {
        currentPage: page,
        totalPages,
        totalFiles,
        hasNext: page < totalPages,
        hasPrev: page > 1,
      },
    });
  } catch (error) {
    console.error("Get files error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve files",
      error: error.message,
    });
  }
};

export const getFilesByPatient = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context missing" });
    }

    const { patientId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(patientId)) {
      return res.status(400).json({ message: "Invalid patient ID" });
    }

    const files = await File.find({
      hospital: hospitalId,
      patient: patientId,
    })
      .populate("patient", "name email phone")
      .sort({ uploadedAt: -1 })
      .select("-__v")
      .lean();

    res.status(200).json({
      success: true,
      message: "Patient files retrieved successfully",
      data: files,
      count: files.length,
    });
  } catch (error) {
    console.error("Get patient files error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve patient files",
      error: error.message,
    });
  }
};

export const getFileById = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context missing" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid file ID" });
    }

    const file = await File.findOne({
      _id: id,
      hospital: hospitalId,
    })
      .populate("patient", "name email phone")
      .select("-__v")
      .lean();

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "File retrieved successfully",
      data: file,
    });
  } catch (error) {
    console.error("Get file by ID error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to retrieve file",
      error: error.message,
    });
  }
};

export const deleteFile = async (req, res) => {
  try {
    const hospitalId = req.session.hospitalId;
    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context missing" });
    }

    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ message: "Invalid file ID" });
    }

    const file = await File.findOneAndDelete({
      _id: id,
      hospital: hospitalId,
    });

    if (!file) {
      return res.status(404).json({
        success: false,
        message: "File not found",
      });
    }

    res.status(200).json({
      success: true,
      message: "File deleted successfully",
    });
  } catch (error) {
    console.error("Delete file error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to delete file",
      error: error.message,
    });
  }
};
