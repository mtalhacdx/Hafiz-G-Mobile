const mongoose = require('mongoose');
const env = require('../src/config/env');
const Product = require('../src/models/Product');

async function run() {
  await mongoose.connect(env.mongodbUri);

  const samePriceProducts = await Product.find({
    $expr: { $eq: ['$purchasePrice', '$salePrice'] },
  })
    .select('_id purchasePrice')
    .lean();

  if (samePriceProducts.length === 0) {
    console.log(JSON.stringify({ matched: 0, modified: 0 }, null, 2));
    await mongoose.disconnect();
    return;
  }

  const ops = samePriceProducts.map((doc) => ({
    updateOne: {
      filter: { _id: doc._id },
      update: { $set: { salePrice: doc.purchasePrice + 10 } },
    },
  }));

  const result = await Product.bulkWrite(ops);

  console.log(
    JSON.stringify(
      {
        matched: samePriceProducts.length,
        modified: result.modifiedCount,
      },
      null,
      2,
    ),
  );

  await mongoose.disconnect();
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
