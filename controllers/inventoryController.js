import InventoryCategory from "../models/inventoryCategoryModel.js";
import InventoryItem from "../models/inventoryItemModel.js";
import { calculateUsageAndStatus } from "../utils/inventoryUtils.js";

export const createCategory = async (req, res) => {
  try {
    const { name, description, departmentId } = req.body;
    const hospitalId = req.session.hospitalId;

    if (!name || !departmentId) {
      return res.status(400).json({ message: "Category name and department are required." });
    }

    const category = new InventoryCategory({
      name,
      description,
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

export const updateCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const { name, description, departmentId } = req.body;
    const hospitalId = req.session.hospitalId;

    const category = await InventoryCategory.findOne({ _id: categoryId, hospital: hospitalId });
    if (!category) {
      return res.status(404).json({ message: "Category not found or unauthorized." });
    }

    if (name !== undefined) category.name = name;
    if (description !== undefined) category.description = description;
    if (departmentId !== undefined) category.department = departmentId;

    await category.save();

    res.status(200).json({ message: "Inventory category updated successfully", data: category });
  } catch (error) {
    console.error("Error updating category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addInventoryItem = async (req, res) => {
  try {
    const { name, quantity, categoryId, minimumStockThreshold, lastRestockedDate } = req.body;
    const hospitalId = req.session.hospitalId;

    if (!name || quantity === undefined || !categoryId) {
      return res.status(400).json({ message: "Name, quantity, and category are required." });
    }

    const category = await InventoryCategory.findById(categoryId);
    if (!category) return res.status(404).json({ message: "Category not found." });

    const threshold = minimumStockThreshold || 10;
    const { usagePercent, status } = calculateUsageAndStatus(quantity, threshold);

    const item = new InventoryItem({
      name,
      quantity,
      minimumStockThreshold: threshold,
      category: category._id,
      department: category.department,
      hospital: category.hospital,
      usagePercent,
      status,
      lastRestockedDate: lastRestockedDate ? new Date(lastRestockedDate) : undefined,
    });

    await item.save();
    res.status(201).json({ message: "Inventory item added", data: item });
  } catch (error) {
    console.error("Error adding item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const updateInventoryItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const { name, quantity, minimumStockThreshold, lastRestockedDate, usagePercent, status } = req.body;

    const item = await InventoryItem.findById(itemId);
    if (!item) return res.status(404).json({ message: "Item not found." });

    if (name !== undefined) item.name = name;
    if (quantity !== undefined) item.quantity = quantity;
    if (minimumStockThreshold !== undefined) item.minimumStockThreshold = minimumStockThreshold;
    if (lastRestockedDate) item.lastRestockedDate = new Date(lastRestockedDate);
    if (usagePercent !== undefined) item.usagePercent = usagePercent; 
    if (status !== undefined) item.status = status;                   

    item.lastUpdated = new Date();
    await item.save();
    res.status(200).json({ message: "Inventory item updated", data: item });
  } catch (error) {
    console.error("Error updating item:", error);
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
            description: category.description,
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

export const getCategoriesByDepartment = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const hospitalId = req.session.hospitalId;

    const categories = await InventoryCategory.find({
      department: departmentId,
      hospital: hospitalId,
    }).select("name description");

    res.status(200).json({ data: categories });
  } catch (error) {
    console.error("Error fetching categories:", error);
    res.status(500).json({ message: "Failed to fetch categories" });
  }
};

export const getInventorySummary = async (req, res) => {
  try {
    const { departmentId } = req.params;
    const hospitalId = req.session.hospitalId;

    const categories = await InventoryCategory.find({ department: departmentId, hospital: hospitalId });

    let total = 0;
    const breakdown = [];

    for (const category of categories) {
      const items = await InventoryItem.find({ category: category._id });

      const quantity = items.reduce((sum, item) => sum + item.quantity, 0);
      total += quantity;

      breakdown.push({
        category: category.name,
        quantity,
      });
    }

    const result = breakdown.map((entry) => ({
      ...entry,
      percent: total > 0 ? Math.round((entry.quantity / total) * 100) : 0,
    }));

    res.status(200).json({ total, breakdown: result });
  } catch (error) {
    console.error("Error fetching inventory summary:", error);
    res.status(500).json({ message: "Failed to generate inventory summary" });
  }
};

export const deleteInventoryItem = async (req, res) => {
  try {
    const { itemId } = req.params;
    const hospitalId = req.session.hospitalId;

    // Find item that belongs to current hospital
    const item = await InventoryItem.findOne({ _id: itemId, hospital: hospitalId });

    if (!item) {
      return res.status(404).json({ message: "Inventory item not found or unauthorized." });
    }

    await item.deleteOne(); // safely deletes only if item is found for this hospital
    res.status(200).json({ message: "Inventory item deleted successfully." });
  } catch (error) {
    console.error("Error deleting inventory item:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const deleteInventoryCategory = async (req, res) => {
  try {
    const { categoryId } = req.params;
    const hospitalId = req.session.hospitalId;

    // Check if category belongs to this hospital
    const category = await InventoryCategory.findOne({ _id: categoryId, hospital: hospitalId });
    if (!category) {
      return res.status(404).json({ message: "Category not found or unauthorized." });
    }

    // Delete all items under this category
    await InventoryItem.deleteMany({ category: category._id });

    // Delete the category itself
    await category.deleteOne();

    res.status(200).json({ message: "Category and related items deleted successfully." });
  } catch (error) {
    console.error("Error deleting category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};
