// import mongoose from 'mongoose';
// import dotenv from 'dotenv';
// import fs from 'fs/promises'; // Use promises version for async operations
// import path from 'path';
// import url from 'url';
// import Migration from '../models/migrationModel.js';

// // Load environment variables
// dotenv.config({ path: '../.env' });

// // Resolve __dirname for ES modules
// const __filename = url.fileURLToPath(import.meta.url);
// const __dirname = path.dirname(__filename);

// // Log MongoDB URI for debugging
// console.log('MongoDB URI:', process.env.MongoDbURI);

// // Load all model schemas dynamically
// const loadModels = async () => {
//   const modelsPath = path.join(__dirname, '../models');
//   const modelFiles = await fs.readdir(modelsPath);
//   const models = {};

//   for (const file of modelFiles) {
//     if (file.endsWith('.js')) {
//       // Convert path to a file URL for dynamic import
//       const filePath = url.pathToFileURL(path.join(modelsPath, file)).href;

//       // Dynamically import the model
//       const { default: model } = await import(filePath);
//       models[model.modelName] = model.schema.obj; // Store schema fields
//     }
//   }
//   return models;
// };

// // Get current schema from the database
// const getCurrentSchema = async (modelName) => {
//   const sample = await mongoose.connection.db
//     .collection(modelName.toLowerCase() + 's') // Collection names are usually plural
//     .findOne({});
//   return sample ? Object.keys(sample) : [];
// };

// // Compare schemas to detect new fields
// const detectSchemaChanges = (currentSchema, modelSchema) => {
//   const newFields = [];
//   for (const field in modelSchema) {
//     if (!currentSchema.includes(field)) {
//       newFields.push(field);
//     }
//   }
//   return newFields;
// };

// // Apply migrations for new fields
// const applyMigrations = async () => {
//   try {
//     // Connect to MongoDB
//     await mongoose.connect(process.env.MongoDbURI);
//     console.log('MongoDB connected successfully.');

//     const models = await loadModels(); // Dynamically load models

//     for (const [modelName, schemaObj] of Object.entries(models)) {
//       console.log(`Checking model: ${modelName}...`);

//       const currentSchema = await getCurrentSchema(modelName); // Get schema from DB
//       const newFields = detectSchemaChanges(currentSchema, schemaObj); // Detect new fields

//       if (newFields.length > 0) {
//         console.log(`New fields detected in ${modelName}:`, newFields);

//         const migrationName = `addFieldsTo${modelName}`;
//         const existingMigration = await Migration.findOne({ name: migrationName });

//         if (!existingMigration) {
//           console.log(`Applying migration '${migrationName}'...`);

//           // Prepare update object for each new field
//           const updateFields = {};
//           newFields.forEach((field) => {
//             // Set to default value if defined, or null if not
//             updateFields[field] = schemaObj[field]?.default !== undefined
//               ? schemaObj[field].default
//               : null;
//           });

//           // Apply the update to all documents in the collection
//           const collectionName = modelName.toLowerCase() + 's'; // Adjust if pluralization differs
//           await mongoose.connection.db
//             .collection(collectionName)
//             .updateMany({}, { $set: updateFields }); // Add new fields to all documents

//           // Record the migration
//           await Migration.create({ name: migrationName });
//           console.log(`Migration '${migrationName}' applied successfully.`);
//         } else {
//           console.log(`Migration '${migrationName}' already applied.`);
//         }
//       } else {
//         console.log(`No new fields detected in ${modelName}.`);
//       }
//     }

//     console.log('All migrations executed.');
//     process.exit(0);
//   } catch (error) {
//     console.error('Migration failed:', error);
//     process.exit(1);
//   }
// };

// // Execute migrations
// applyMigrations();

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import fs from 'fs/promises'; // Use promises version for async operations
import path from 'path';
import url from 'url';
import Migration from '../models/migrationModel.js';

// Load environment variables
dotenv.config({ path: '../.env' });

// Resolve __dirname for ES modules
const __filename = url.fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Log MongoDB URI for debugging
console.log('MongoDB URI:', process.env.MongoDbURI);

// Load all model schemas dynamically
const loadModels = async () => {
  const modelsPath = path.join(__dirname, '../models');
  const modelFiles = await fs.readdir(modelsPath);
  const models = {};

  for (const file of modelFiles) {
    if (file.endsWith('.js')) {
      // Convert path to a file URL for dynamic import
      const filePath = url.pathToFileURL(path.join(modelsPath, file)).href;

      // Dynamically import the model
      const { default: model } = await import(filePath);
      models[model.modelName] = model.schema.obj; // Store schema fields
    }
  }
  return models;
};

// Get current schema from the database
const getCurrentSchema = async (modelName) => {
  const sample = await mongoose.connection.db
    .collection(modelName.toLowerCase() + 's') // Collection names are usually plural
    .findOne({});
  return sample ? Object.keys(sample) : [];
};

// Compare schemas to detect new fields
const detectSchemaChanges = (currentSchema, modelSchema) => {
  const newFields = [];
  for (const field in modelSchema) {
    if (!currentSchema.includes(field)) {
      newFields.push(field);
    }
  }
  return newFields;
};

// Apply migrations for new fields
const applyMigrations = async () => {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MongoDbURI);
    console.log('MongoDB connected successfully.');

    const models = await loadModels(); // Dynamically load models

    for (const [modelName, schemaObj] of Object.entries(models)) {
      console.log(`Checking model: ${modelName}...`);

      const currentSchema = await getCurrentSchema(modelName);
      const newFields = detectSchemaChanges(currentSchema, schemaObj);

      if (newFields.length > 0) {
        console.log(`New fields detected in ${modelName}:`, newFields);

        const migrationName = `addFieldsTo${modelName}`;
        const existingMigration = await Migration.findOne({ name: migrationName });

        if (!existingMigration) {
          console.log(`Applying migration '${migrationName}'...`);

          const updateFields = {};
          newFields.forEach((field) => {
            updateFields[field] = schemaObj[field].default || null; // Use default value if available, else null
          });

          await mongoose.connection.db
            .collection(modelName.toLowerCase() + 's')
            .updateMany({}, { $set: updateFields });

          await Migration.create({ name: migrationName });
          console.log(`Migration '${migrationName}' applied successfully.`);
        } else {
          console.log(`Migration '${migrationName}' already applied.`);
        }
      } else {
        console.log(`No new fields detected in ${modelName}.`);
      }
    }

    console.log('All migrations executed.');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

// Execute migrations
applyMigrations();