const buildInvoiceNumber = (prefix) => {
  const stamp = Date.now().toString(36).toUpperCase();
  const random = Math.floor(Math.random() * 10000)
    .toString()
    .padStart(4, "0");

  return `${prefix}-${stamp}-${random}`;
};

module.exports = { buildInvoiceNumber };
