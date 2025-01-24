import { editResource, deleteResource } from "../utils/resourceOperations.js";

export const handleEdit = async (req, res) => {
  const { id } = req.params;
  const updates = req.body;
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({ message: 'Unauthorized access. Hospital ID not found in session.' });
  }

  try {
    const updatedResource = await editResource(id, updates, hospitalId);
    res.status(200).json({ message: 'Resource updated successfully.', resource: updatedResource });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};

export const handleDelete = async (req, res) => {
  const { id } = req.params;
  const { hospitalId } = req.session;

  if (!hospitalId) {
    return res.status(403).json({ message: 'Unauthorized access. Hospital ID not found in session.' });
  }

  try {
    const deletedResource = await deleteResource(id, hospitalId);
    res.status(200).json({ message: 'Resource deleted successfully.', resource: deletedResource });
  } catch (error) {
    res.status(404).json({ message: error.message });
  }
};
