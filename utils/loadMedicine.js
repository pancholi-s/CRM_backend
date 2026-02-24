import fs from "fs";
import csv from "csv-parser";

let medicines = [];

export const loadMedicines = () => {
  return new Promise((resolve, reject) => {
    medicines = [];

    fs.createReadStream("data/medicine_dataset.csv")
      .pipe(csv())
      .on("data", (row) => {
        medicines.push({
          brandName: row.brand_name || row.Brand || "",
          salt: row.salt || row.Salt || "",
          manufacturer: row.manufacturer || row.Manufacturer || ""
        });
      })
      .on("end", () => {
        console.log("✅ Medicine dataset loaded:", medicines.length);
        resolve();
      })
      .on("error", reject);
  });
};

export const getMedicines = () => medicines;