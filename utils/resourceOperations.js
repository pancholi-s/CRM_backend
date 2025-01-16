export const editResource = async (model, id, updates, hospitalId) => {
  const updatedResource = await model.findOneAndUpdate(
    { _id: id, hospital: hospitalId }, // Ensure the hospital context matches
    updates,
    { new: true } // Return the updated document
  );

  if (!updatedResource)
    throw new Error(`${model.modelName} not found or access denied.`);

  return updatedResource;
};

export const deleteResource = async (model, id, hospitalId) => {
  const deletedResource = await model.findOneAndDelete({
    _id: id,
    hospital: hospitalId,
  });

  if (!deletedResource)
    throw new Error(`${model.modelName} not found or access denied.`);

  return deletedResource;
};
