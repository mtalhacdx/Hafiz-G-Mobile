const mongoose = require("mongoose");

const env = require("../src/config/env");
const Category = require("../src/models/Category");
const Brand = require("../src/models/Brand");
const Supplier = require("../src/models/Supplier");

const TARGET = 15;

const categoryPool = [
  "Audio",
  "Wearables",
  "Gaming",
  "Storage",
  "Networking",
  "Smart Home",
  "Repair Tools",
  "Mounts",
  "Camera Gear",
  "Office",
];

const brandPool = [
  "Titan",
  "Echo",
  "Zenith",
  "Nimbus",
  "Ranger",
  "Comet",
  "Delta",
  "Lyra",
  "Omega",
  "Horizon",
  "Atlas",
  "Bolt",
  "Core",
  "Matrix",
  "Fusion",
];

const nextUnique = (base, used) => {
  let name = base;
  let suffix = 1;

  while (used.has(name.toLowerCase())) {
    name = `${base} ${suffix}`;
    suffix += 1;
  }

  used.add(name.toLowerCase());
  return name;
};

const main = async () => {
  await mongoose.connect(env.mongodbUri);

  try {
    const [categoryCount, brandCount, supplierCount] = await Promise.all([
      Category.countDocuments({}),
      Brand.countDocuments({}),
      Supplier.countDocuments({}),
    ]);

    const addCategories = Math.max(0, TARGET - categoryCount);
    const addBrands = Math.max(0, TARGET - brandCount);
    const addSuppliers = Math.max(0, TARGET - supplierCount);

    const usedCategories = new Set(
      (await Category.find({}, "categoryName")).map((item) => String(item.categoryName || "").toLowerCase())
    );

    const usedBrands = new Set(
      (await Brand.find({}, "brandName")).map((item) => String(item.brandName || "").toLowerCase())
    );

    const categories = Array.from({ length: addCategories }, (_, index) => {
      const base = categoryPool[index % categoryPool.length];
      const categoryName = nextUnique(base, usedCategories);
      return {
        categoryName,
        description: `${categoryName} category`,
        isActive: true,
      };
    });

    const brands = Array.from({ length: addBrands }, (_, index) => {
      const base = brandPool[index % brandPool.length];
      const brandName = nextUnique(base, usedBrands);
      return {
        brandName,
        description: `${brandName} brand`,
        isActive: true,
      };
    });

    const suppliers = Array.from({ length: addSuppliers }, (_, index) => ({
      name: `Supplier Extra ${String(index + 1).padStart(2, "0")}`,
      phone: `0320${String(3000000 + index).slice(-7)}`,
      address: `Supplier Extension ${index + 1}`,
      balance: 0,
      isActive: true,
    }));

    if (categories.length) {
      await Category.insertMany(categories);
    }

    if (brands.length) {
      await Brand.insertMany(brands);
    }

    if (suppliers.length) {
      await Supplier.insertMany(suppliers);
    }

    const [finalCategories, finalBrands, finalSuppliers] = await Promise.all([
      Category.countDocuments({}),
      Brand.countDocuments({}),
      Supplier.countDocuments({}),
    ]);

    console.log(
      JSON.stringify(
        {
          added: {
            categories: addCategories,
            brands: addBrands,
            suppliers: addSuppliers,
          },
          final: {
            categories: finalCategories,
            brands: finalBrands,
            suppliers: finalSuppliers,
          },
        },
        null,
        2
      )
    );
  } finally {
    await mongoose.disconnect();
  }
};

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
