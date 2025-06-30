import InventoryCategory from "../models/inventoryCategoryModel.js";
import InventoryItem from "../models/inventoryItemModel.js";

export const createCategory = async (req, res) => {
  try {
    const { name, description, minimumStockThreshold, departmentId } = req.body;
    const hospitalId = req.session.hospitalId;

    if (!name || !departmentId) {
      return res
        .status(400)
        .json({ message: "Category name and department are required." });
    }

    const category = new InventoryCategory({
      name,
      description,
      minimumStockThreshold: minimumStockThreshold || 10,
      department: departmentId,
      hospital: hospitalId,
    });

    await category.save();
    res
      .status(201)
      .json({ message: "Inventory category created", data: category });
  } catch (error) {
    console.error("Error creating category:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

export const addInventoryItem = async (req, res) => {
  try {
    const { name, quantity, categoryId, lastRestockedDate } = req.body;

    if (!name || quantity === undefined || !categoryId) {
      return res
        .status(400)
        .json({ message: "Name, quantity, and category are required." });
    }

    const category = await InventoryCategory.findById(categoryId);
    if (!category) {
      return res.status(404).json({ message: "Category not found." });
    }

    const item = new InventoryItem({
      name,
      quantity,
      category: category._id,
      department: category.department,
      hospital: category.hospital,
      lastRestockedDate: lastRestockedDate
        ? new Date(lastRestockedDate)
        : undefined,
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
    const { quantity, usagePercent, lastRestockedDate, status } = req.body;

    const item = await InventoryItem.findById(itemId);
    if (!item) {
      return res.status(404).json({ message: "Item not found." });
    }

    if (quantity !== undefined) item.quantity = quantity;
    if (usagePercent !== undefined) item.usagePercent = usagePercent;
    if (status !== undefined) item.status = status;
    if (lastRestockedDate) item.lastRestockedDate = new Date(lastRestockedDate);

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

    const categories = await InventoryCategory.find({
      department: departmentId,
      hospital: hospitalId,
    });

    const result = await Promise.all(
      categories.map(async (category) => {
        const items = await InventoryItem.find({ category: category._id });
        return {
          category: {
            _id: category._id,
            name: category.name,
            description: category.description,
            minimumStockThreshold: category.minimumStockThreshold,
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
    }).select("name description minimumStockThreshold");

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

    const categories = await InventoryCategory.find({
      department: departmentId,
      hospital: hospitalId,
    });

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
