import { editResource, deleteResource } from "../utils/resourceOperations.js";

export const handleEdit = async (req, res) => {
  try {
    const { modelName, id } = req.params;
    const updates = req.body;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res
        .status(403)
        .json({ message: "Unauthorized access. No hospital context." });
    }

    const { default: model } = await import(`../models/${modelName}.js`);
    const updated = await editResource(model, id, updates, hospitalId);

    res
      .status(200)
      .json({ message: `${modelName} updated successfully`, updated });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const handleDelete = async (req, res) => {
  try {
    const { modelName, id } = req.params;
    const hospitalId = req.session.hospitalId;

    if (!hospitalId) {
      return res
        .status(403)
        .json({ message: "Unauthorized access. No hospital context." });
    }

    const { default: model } = await import(`../models/${modelName}.js`);
    const deleted = await deleteResource(model, id, hospitalId);

    res
      .status(200)
      .json({ message: `${modelName} deleted successfully`, deleted });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
