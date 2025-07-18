import ConsultationForm from "../models/consultationFormModel.js";

// Create
export const createConsultationForm = async (req, res) => {
  try {
    const { title, sections } = req.body;
    const hospitalId = req.session?.hospitalId;
    const doctorId = req.user?._id;

    if (!hospitalId || !doctorId || !title || !Array.isArray(sections)) {
      return res.status(400).json({ message: "Missing required fields or sections format." });
    }

    const newForm = await ConsultationForm.create({
      hospital: hospitalId,
      doctor: doctorId,
      title,
      sections,
    });

    res.status(201).json({
      message: "Form created successfully",
      form: newForm,
    });
  } catch (error) {
    console.error("Error creating consultation form:", error);
    res.status(500).json({ message: "Failed to create form." });
  }
};

// Get All (with filters and pagination)
export const getConsultationForms = async (req, res) => {
  try {
    const { doctorId, page = 1, limit = 10 } = req.query;
    const hospitalId = req.session?.hospitalId;

    if (!hospitalId) {
      return res.status(400).json({ message: "Hospital context is required." });
    }

    const filter = { hospital: hospitalId };
    if (doctorId) filter.doctor = doctorId;

    const pageNumber = parseInt(page);
    const limitNumber = parseInt(limit);
    const skip = (pageNumber - 1) * limitNumber;

    const total = await ConsultationForm.countDocuments(filter);
    const forms = await ConsultationForm.find(filter)
      .populate("doctor", "name email")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNumber);

    res.status(200).json({
      total,
      page: pageNumber,
      pageSize: forms.length,
      totalPages: Math.ceil(total / limitNumber),
      forms,
    });
  } catch (error) {
    console.error("Error fetching consultation forms:", error);
    res.status(500).json({ message: "Failed to fetch forms." });
  }
};

// Get By ID
export const getConsultationFormById = async (req, res) => {
  try {
    const form = await ConsultationForm.findById(req.params.id)
      .populate("doctor", "name email");

    if (!form) {
      return res.status(404).json({ message: "Form not found" });
    }

    res.status(200).json({ form });
  } catch (error) {
    console.error("Error fetching form:", error);
    res.status(500).json({ message: "Failed to fetch form." });
  }
};

// Update
export const updateConsultationForm = async (req, res) => {
  try {
    const formId = req.params.id;
    const { title, sections } = req.body;

    const form = await ConsultationForm.findById(formId);

    if (!form) {
      return res.status(404).json({ message: "Form not found." });
    }

    if (title !== undefined) form.title = title;
    if (sections !== undefined && Array.isArray(sections)) {
      form.sections = sections;
    }

    const updatedForm = await form.save();

    const populatedForm = await ConsultationForm.findById(updatedForm._id)
      .populate("doctor", "name email");

    res.status(200).json({
      message: "Form updated successfully",
      form: populatedForm,
    });
  } catch (error) {
    console.error("Error updating form:", error);
    res.status(500).json({ message: "Failed to update form." });
  }
};

// Delete
export const deleteConsultationForm = async (req, res) => {
  try {
    const form = await ConsultationForm.findById(req.params.id);
    if (!form) {
      return res.status(404).json({ message: "Form not found." });
    }

    await ConsultationForm.findByIdAndDelete(req.params.id);
    res.status(200).json({ message: "Form deleted successfully." });
  } catch (error) {
    console.error("Error deleting form:", error);
    res.status(500).json({ message: "Failed to delete form." });
  }
};
