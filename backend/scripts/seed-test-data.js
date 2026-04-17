const mongoose = require("mongoose");

const env = require("../src/config/env");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Supplier = require("../src/models/Supplier");
const Customer = require("../src/models/Customer");
const Product = require("../src/models/Product");

const TARGET = {
  categoriesToAdd: 8,
  brandsToAdd: 5,
  suppliersToAdd: 10,
  customersToAdd: 30,
  productsToAdd: 100,
};

const CATEGORY_BASE = [
  "Accessories",
  "Chargers",
  "Cables",
  "Batteries",
  "Power Banks",
  "Handfree",
  "Mobile Covers",
  "Tempered Glass",
  "Adapters",
  "Memory Cards",
];

const BRAND_BASE = ["Nova", "Apex", "Prime", "Orbit", "Pulse", "Spark", "Vertex"];

const randomInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

const randomFrom = (arr) => arr[randomInt(0, arr.length - 1)];

const uniqueName = (base, used) => {
  let candidate = base;
  let index = 1;

  while (used.has(candidate.toLowerCase())) {
    candidate = `${base} ${index}`;
    index += 1;
  }

  used.add(candidate.toLowerCase());
  return candidate;
};

const main = async () => {
  await mongoose.connect(env.mongodbUri);

  try {
    const [existingCategories, existingBrands] = await Promise.all([
      Category.find({}, "categoryName"),
      Brand.find({}, "brandName"),
    ]);

    const usedCategoryNames = new Set(existingCategories.map((item) => String(item.categoryName || "").toLowerCase()));
    const usedBrandNames = new Set(existingBrands.map((item) => String(item.brandName || "").toLowerCase()));

    const categoriesToInsert = Array.from({ length: TARGET.categoriesToAdd }, (_, i) => {
      const base = CATEGORY_BASE[i % CATEGORY_BASE.length];
      const name = uniqueName(base, usedCategoryNames);
      return {
        categoryName: name,
        description: `${name} test category`,
        isActive: true,
      };
    });

    const brandsToInsert = Array.from({ length: TARGET.brandsToAdd }, (_, i) => {
      const base = BRAND_BASE[i % BRAND_BASE.length];
      const name = uniqueName(base, usedBrandNames);
      return {
        brandName: name,
        description: `${name} test brand`,
        isActive: true,
      };
    });

    const suppliersToInsert = Array.from({ length: TARGET.suppliersToAdd }, (_, i) => ({
      name: `Supplier ${String(i + 1).padStart(2, "0")}`,
      phone: `0300${String(1000000 + i).slice(-7)}`,
      address: `Supplier Street ${i + 1}`,
      balance: 0,
      isActive: true,
    }));

    const customersToInsert = Array.from({ length: TARGET.customersToAdd }, (_, i) => ({
      name: `Customer ${String(i + 1).padStart(2, "0")}`,
      phone: `0310${String(2000000 + i).slice(-7)}`,
      address: `Customer Area ${i + 1}`,
      balance: 0,
      isActive: true,
    }));

    const [newCategories, newBrands, newSuppliers] = await Promise.all([
      Category.insertMany(categoriesToInsert),
      Brand.insertMany(brandsToInsert),
      Supplier.insertMany(suppliersToInsert),
    ]);

    await Customer.insertMany(customersToInsert);

    const categoryPool = newCategories;
    const brandPool = newBrands;
    const supplierPool = newSuppliers;

    const productNamesUsed = new Set();
    const productsToInsert = Array.from({ length: TARGET.productsToAdd }, (_, i) => {
      const category = randomFrom(categoryPool);
      const brand = randomFrom(brandPool);
      const supplier = randomFrom(supplierPool);

      const baseName = `${brand.brandName} ${category.categoryName} ${i + 1}`;
      const name = uniqueName(baseName, productNamesUsed);

      const purchasePrice = randomInt(1, 9) * 10;
      const salePrice = Math.min(purchasePrice + randomInt(1, 3) * 10, 100);

      return {
        name,
        brandName: brand.brandName,
        categoryId: category._id,
        purchasePrice,
        salePrice: Math.min(salePrice, 100),
        stockQuantity: randomInt(10, 220),
        minStockLevel: randomInt(2, 15),
        claimStockQuantity: 0,
        supplierId: supplier._id,
        isActive: true,
      };
    });

    await Product.insertMany(productsToInsert);

    console.log("Seed complete:");
    console.log(`- Categories added: ${TARGET.categoriesToAdd}`);
    console.log(`- Brands added: ${TARGET.brandsToAdd}`);
    console.log(`- Suppliers added: ${TARGET.suppliersToAdd}`);
    console.log(`- Customers added: ${TARGET.customersToAdd}`);
    console.log(`- Products added: ${TARGET.productsToAdd}`);
    console.log("- Purchases added: 0 (as requested)");
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error("Seed failed:", error.message);
  process.exitCode = 1;
});
