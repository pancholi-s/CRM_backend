import InventoryCategory from "../models/inventoryCategoryModel.js";
import InventoryItem from "../models/inventoryItemModel.js";

export const createCategory = async (req, res) => {
  try {
    const { name, departmentId } = req.body;
    const hospitalId = req.session.hospitalId;

    if (!name || !departmentId) {
      return res.status(400).json({ message: "Category name and department are required." });
    }

    const category = new InventoryCategory({
      name,
      department: departmentId,
      hospital: hospitalId,
    });

    await category.save();
    res.status(201).json({ message: "Inventory category created", data: category });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addInventoryItem = async (req, res) => {
  try {
    const { name, quantity, usagePercent, status, categoryId } = req.body;

    if (!name || !quantity || !categoryId) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    const category = await InventoryCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const item = new InventoryItem({
      name,
      quantity,
      usagePercent: usagePercent || 0,
      status: status || "Sufficient",
      category: category._id,
      department: category.department,
      hospital: category.hospital,
    });

    await item.save();
    res.status(201).json({ message: "Inventory item added", data: item });
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const getInventoryByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const hospitalId = req.session.hospitalId;

    const categories = await InventoryCategory.find({ department: departmentId, hospital: hospitalId });

    const result = await Promise.all(
      categories.map(async (category) => {
        const items = await InventoryItem.find({ category: category._id });
        return {
          category: {
            _id: category._id,
            name: category.name,
          },
          items,
        };
      })
    );

    res.status(200).json({ data: result });
  } catch (error) {
    console.error("Error fetching inventory:", error);
    res.status(500).json({ message: "Failed to fetch inventory" });
  }
};