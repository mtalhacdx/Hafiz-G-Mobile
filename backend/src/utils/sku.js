const sanitizeSkuPart = (value) => String(value || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

const buildSkuBase = ({ name, brandName }) => {
  const namePart = sanitizeSkuPart(name).slice(0, 4) || "ITEM";
  const brandPart = sanitizeSkuPart(brandName).slice(0, 3) || "GEN";
  return `SKU-${brandPart}-${namePart}`;
};

const ensureUniqueSku = async ({ Product, baseSku, excludeId = null }) => {
  let candidate = baseSku;
  let counter = 1;

  while (true) {
    const query = { sku: candidate };
    if (excludeId) {
      query._id = { $ne: excludeId };
    }

    const exists = await Product.exists(query);
    if (!exists) {
      return candidate;
    }

    candidate = `${baseSku}-${counter}`;
    counter += 1;
  }
};

module.exports = {
  buildSkuBase,
  ensureUniqueSku,
};
