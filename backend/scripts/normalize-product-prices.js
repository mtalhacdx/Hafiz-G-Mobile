const mongoose = require('mongoose');

const env = require('../src/config/env');
const Product = require('../src/models/Product');

const toNearestTen = (value) => {
  const numeric = Number(value || 0);
  return Math.max(10, Math.round(numeric / 10) * 10);
};

async function main() {
  await mongoose.connect(env.mongodbUri);

  try {
    const products = await Product.find({}).select('_id purchasePrice salePrice').lean();

    const ops = products.map((product) => {
      const normalizedPurchase = toNearestTen(product.purchasePrice);
      let normalizedSale = toNearestTen(product.salePrice);

      // Keep business rule strict: sale price must be greater than purchase price.
      if (normalizedSale <= normalizedPurchase) {
        normalizedSale = normalizedPurchase + 10;
      }

      return {
        updateOne: {
          filter: { _id: product._id },
          update: {
            $set: {
              purchasePrice: normalizedPurchase,
              salePrice: normalizedSale,
            },
          },
        },
      };
    });

    const result = await Product.bulkWrite(ops);

    const invalid = await Product.countDocuments({
      $expr: { $or: [{ $gte: ['$purchasePrice', '$salePrice'] }, { $ne: [{ $mod: ['$purchasePrice', 10] }, 0] }, { $ne: [{ $mod: ['$salePrice', 10] }, 0] }] },
    });

    console.log(
      JSON.stringify(
        {
          processed: products.length,
          modified: result.modifiedCount,
          invalidAfterNormalize: invalid,
        },
        null,
        2,
      ),
    );
  } finally {
    await mongoose.disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
