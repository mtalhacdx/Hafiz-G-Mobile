import { useEffect, useMemo, useState } from "react";
import ExcelJS from "exceljs";
import Layout from "../components/Layout";
import client from "../api/client";
import useToastMessage from "../hooks/useToastMessage";

const PAGE_SIZE = 10;

const tabs = [
  { id: "sales", label: "Sales" },
  { id: "purchases", label: "Purchases" },
  { id: "dues", label: "Dues" },
  { id: "claims", label: "Claims" },
  { id: "stock", label: "Stock" },
  { id: "customers", label: "Customers" },
  { id: "suppliers", label: "Suppliers" },
  { id: "profit", label: "Profit" },
];

const currency = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const contributesClaimLoss = (claim) => {
  if (["pending", "sent_to_supplier", "rejected"].includes(claim?.status)) {
    return true;
  }

  return claim?.status === "closed" && claim?.supplierStatus === "rejected";
};

const claimLossAmount = (claim) => {
  const explicitLoss = Number(claim?.lossAmount || 0);
  if (explicitLoss > 0) {
    return explicitLoss;
  }

  return Number(claim?.quantity || 0) * Number(claim?.purchasePrice || 0);
};

const dateShort = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
});

const SETTINGS_STORAGE_KEY = "hafizg_settings_v1";

const getStoreNameFromSettings = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return "HafizG Mobile";
    }

    const parsed = JSON.parse(raw);
    const storeName = String(parsed?.general?.storeName || "").trim();
    return storeName || "HafizG Mobile";
  } catch (_error) {
    return "HafizG Mobile";
  }
};

const resolveGeneratedByLabel = (invoice, storeName) => {
  const role = String(invoice?.generatedById?.role || "").toLowerCase();

  if (role === "admin") {
    return storeName || "HafizG Mobile";
  }

  return (
    invoice?.generatedById?.name ||
    invoice?.generatedById?.username ||
    invoice?.generatedByName ||
    "Unknown User"
  );
};

const normalizeDate = (value) => {
  if (!value) {
    return "";
  }

  const dateValue = new Date(value);
  if (Number.isNaN(dateValue.getTime())) {
    return "";
  }

  return dateValue.toISOString().slice(0, 10);
};

const matchesDateRange = (dateValue, fromDate, toDate) => {
  if (!fromDate && !toDate) {
    return true;
  }

  if (!dateValue) {
    return false;
  }

  if (fromDate && dateValue < fromDate) {
    return false;
  }

  if (toDate && dateValue > toDate) {
    return false;
  }

  return true;
};

const downloadStyledWorkbook = async ({ filename, reportTitle, columns, rows }) => {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Hafiz G Mobile Traders";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Report", {
    views: [{ state: "frozen", ySplit: 5 }],
  });

  const totalCols = Math.max(columns.length, 1);
  const startCol = 1;
  const endCol = totalCols;
  const mergeRange = `A1:${String.fromCharCode(64 + endCol)}1`;
  const subtitleRange = `A2:${String.fromCharCode(64 + endCol)}2`;
  const generatedRange = `A3:${String.fromCharCode(64 + endCol)}3`;

  worksheet.mergeCells(mergeRange);
  worksheet.getCell("A1").value = "Hafiz G Mobile Traders";
  worksheet.getCell("A1").font = { bold: true, size: 18, color: { argb: "FFFFFFFF" } };
  worksheet.getCell("A1").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("A1").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FF0B3A67" },
  };
  worksheet.getRow(1).height = 28;

  worksheet.mergeCells(subtitleRange);
  worksheet.getCell("A2").value = reportTitle;
  worksheet.getCell("A2").font = { bold: true, size: 12, color: { argb: "FF123B5D" } };
  worksheet.getCell("A2").alignment = { horizontal: "center", vertical: "middle" };
  worksheet.getCell("A2").fill = {
    type: "pattern",
    pattern: "solid",
    fgColor: { argb: "FFE7EFF7" },
  };

  worksheet.mergeCells(generatedRange);
  worksheet.getCell("A3").value = `Generated: ${new Date().toLocaleString("en-PK")}`;
  worksheet.getCell("A3").font = { italic: true, size: 11, color: { argb: "FF425466" } };
  worksheet.getCell("A3").alignment = { horizontal: "center", vertical: "middle" };

  worksheet.getRow(4).height = 8;

  const headerRow = worksheet.getRow(5);
  columns.forEach((column, index) => {
    const cell = headerRow.getCell(index + 1);
    cell.value = column.label;
    cell.font = { bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "left" };
    cell.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF1F6AA5" },
    };
    cell.border = {
      top: { style: "thin", color: { argb: "FFC2D1E0" } },
      left: { style: "thin", color: { argb: "FFC2D1E0" } },
      bottom: { style: "thin", color: { argb: "FFC2D1E0" } },
      right: { style: "thin", color: { argb: "FFC2D1E0" } },
    };
  });
  headerRow.height = 22;

  rows.forEach((row, rowIndex) => {
    const excelRow = worksheet.addRow(columns.map((column) => column.getValue(row)));
    excelRow.eachCell((cell) => {
      cell.alignment = { vertical: "middle", horizontal: "left", wrapText: true };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE1E8EF" } },
        left: { style: "thin", color: { argb: "FFE1E8EF" } },
        bottom: { style: "thin", color: { argb: "FFE1E8EF" } },
        right: { style: "thin", color: { argb: "FFE1E8EF" } },
      };
      cell.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: rowIndex % 2 === 0 ? "FFF8FBFF" : "FFFFFFFF" },
      };
    });
  });

  columns.forEach((column, index) => {
    const values = rows.map((row) => String(column.getValue(row) ?? ""));
    const maxLen = Math.max(column.label.length, ...values.map((value) => value.length), 10);
    worksheet.getColumn(index + 1).width = Math.min(42, maxLen + 3);
  });

  worksheet.autoFilter = {
    from: { row: 5, column: startCol },
    to: { row: 5, column: endCol },
  };

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const ReportsPage = () => {
  const storeName = useMemo(() => getStoreNameFromSettings(), []);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("sales");
  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);
  const [selectedIds, setSelectedIds] = useState(() => new Set());
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();

  const [sales, setSales] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [duePayments, setDuePayments] = useState([]);
  const [claims, setClaims] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  const loadBase = async () => {
    try {
      setLoading(true);
      setError("");

      const [
        salesRes,
        purchasesRes,
        duePaymentsRes,
        claimsRes,
        productsRes,
        customersRes,
        suppliersRes,
      ] = await Promise.all([
        client.get("/sales"),
        client.get("/purchases"),
        client.get("/due-payments"),
        client.get("/claims"),
        client.get("/products"),
        client.get("/customers", { params: { includeInactive: true } }),
        client.get("/suppliers", { params: { includeInactive: true } }),
      ]);

      setSales(salesRes.data?.data || []);
      setPurchases(purchasesRes.data?.data || []);
      setDuePayments(duePaymentsRes.data?.data || []);
      setClaims(claimsRes.data?.data || []);
      setProducts(productsRes.data?.data || []);
      setCustomers(customersRes.data?.data || []);
      setSuppliers(suppliersRes.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load reports");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    setPage(1);
    setSelectedIds(new Set());
    setNotice("");
  }, [activeTab, search, fromDate, toDate]);

  const salesRows = useMemo(
    () =>
      sales.map((row) => {
        const grandTotal = Number(row.grandTotal || 0);
        const paidAmount = Number(row.paidAmount || 0);

        return {
          id: row._id,
          date: normalizeDate(row.date),
          ref: row.invoiceNumber || row._id?.slice(-6) || "-",
          party: row.customerId?.name || "Walk-in",
          generatedBy: resolveGeneratedByLabel(row, storeName),
          status: row.paymentStatus || "-",
          total: grandTotal,
          paid: paidAmount,
          due: Math.max(0, grandTotal - paidAmount),
          items: Array.isArray(row.items) ? row.items.length : 0,
          searchText: `${row.invoiceNumber || ""} ${row.customerId?.name || ""} ${resolveGeneratedByLabel(row, storeName)} ${row.paymentStatus || ""}`,
        };
      }),
    [sales, storeName]
  );

  const purchaseRows = useMemo(
    () =>
      purchases.map((row) => {
        const totalAmount = Number(row.totalAmount || 0);
        const paidAmount = Number(row.paidAmount || 0);

        return {
          id: row._id,
          date: normalizeDate(row.date),
          ref: row.purchaseInvoiceNumber || row._id?.slice(-6) || "-",
          party: row.supplierId?.name || "Unknown",
          status: row.paymentStatus || "-",
          total: totalAmount,
          paid: paidAmount,
          due: Math.max(0, totalAmount - paidAmount),
          items: Array.isArray(row.items) ? row.items.length : 0,
          searchText: `${row.purchaseInvoiceNumber || ""} ${row.supplierId?.name || ""} ${row.paymentStatus || ""}`,
        };
      }),
    [purchases]
  );

  const dueRows = useMemo(
    () =>
      duePayments.map((row) => ({
        id: row._id,
        date: normalizeDate(row.paidAt),
        direction: row.mode === "receivable" ? "received" : "paid",
        invoice: row.invoiceNumber || "-",
        invoiceType: row.sourceInvoiceType || "-",
        party: row.partyName || "-",
        collectedBy:
          row.processedById?.name ||
          row.processedById?.username ||
          row.processedByName ||
          "Unknown User",
        method: (row.paymentMethod || "cash").toUpperCase(),
        amount: Number(row.amount || 0),
        searchText: `${row.invoiceNumber || ""} ${row.partyName || ""} ${row.processedById?.name || row.processedById?.username || row.processedByName || ""} ${row.paymentMethod || ""} ${row.mode || ""}`,
      })),
    [duePayments]
  );

  const claimsRows = useMemo(
    () =>
      claims.map((row) => {
        const quantity = Number(row.quantity || 0);
        const purchasePrice = Number(row.purchasePrice || 0);
        const baseCost = Number((quantity * purchasePrice).toFixed(2));
        const includeInLoss = contributesClaimLoss(row);

        return {
          id: row._id,
          date: normalizeDate(row.createdAt),
          claimNumber: row.claimNumber || row._id?.slice(-6) || "-",
          supplier: row.supplierId?.name || "-",
          customer: row.customerId?.name || "Walk-in",
          product: row.productId?.name || "-",
          quantity,
          replacement: row.replacementGiven ? "yes" : "no",
          supplierStatus: row.supplierStatus || "pending",
          status: row.status || "pending",
          lossImpact: includeInLoss ? Number((claimLossAmount(row) || baseCost).toFixed(2)) : Number(row.lossAmount || 0),
          searchText: `${row.claimNumber || ""} ${row.supplierId?.name || ""} ${row.customerId?.name || ""} ${
            row.productId?.name || ""
          } ${row.status || ""} ${row.supplierStatus || ""}`,
        };
      }),
    [claims]
  );

  const stockRows = useMemo(
    () =>
      products.map((row) => {
        const stockQty = Number(row.stockQuantity || 0);
        const cost = Number(row.purchasePrice || 0);
        const stockValue = stockQty * cost;
        const categoryName = row.categoryId?.categoryName || "-";
        const minStock = Number(row.minStockLevel || 0);

        return {
          id: row._id,
          date: normalizeDate(row.updatedAt || row.createdAt),
          sku: row.sku || "-",
          name: row.name || "-",
          category: categoryName,
          stock: stockQty,
          minStock,
          value: stockValue,
          searchText: `${row.sku || ""} ${row.name || ""} ${categoryName}`,
        };
      }),
    [products]
  );

  const customerRows = useMemo(
    () =>
      customers.map((row) => ({
        id: row._id,
        date: normalizeDate(row.createdAt),
        name: row.name || "-",
        phone: row.phone || "-",
        address: row.address || "-",
        balance: Number(row.balance || 0),
        state: row.isActive === false ? "inactive" : "active",
        searchText: `${row.name || ""} ${row.phone || ""} ${row.address || ""}`,
      })),
    [customers]
  );

  const supplierRows = useMemo(
    () =>
      suppliers.map((row) => ({
        id: row._id,
        date: normalizeDate(row.createdAt),
        name: row.name || "-",
        phone: row.phone || "-",
        address: row.address || "-",
        payable: Number(row.balance || 0),
        state: row.isActive === false ? "inactive" : "active",
        searchText: `${row.name || ""} ${row.phone || ""} ${row.address || ""}`,
      })),
    [suppliers]
  );

  const profitRows = useMemo(() => {
    const productCostById = new Map(
      products.map((product) => [String(product._id), Number(product.purchasePrice || 0)])
    );

    const map = new Map();

    sales.forEach((row) => {
      const day = normalizeDate(row.date);
      if (!day) {
        return;
      }

      const existing = map.get(day) || { sales: 0, cost: 0, purchases: 0, claimLoss: 0 };
      existing.sales += Number(row.grandTotal || 0);

      const invoiceCost = (row.items || []).reduce((sum, item) => {
        const productId = String(item?.productId?._id || item?.productId || "");
        const purchasePrice = productCostById.get(productId) || 0;
        const quantity = Number(item?.quantity || 0);
        return sum + purchasePrice * quantity;
      }, 0);

      existing.cost += invoiceCost;
      map.set(day, existing);
    });

    purchases.forEach((row) => {
      const day = normalizeDate(row.date);
      if (!day) {
        return;
      }

      const existing = map.get(day) || { sales: 0, cost: 0, purchases: 0, claimLoss: 0 };
      existing.purchases += Number(row.totalAmount || 0);
      map.set(day, existing);
    });

    claims.forEach((row) => {
      const day = normalizeDate(row.createdAt);
      if (!day) {
        return;
      }

      if (!contributesClaimLoss(row)) {
        return;
      }

      const existing = map.get(day) || { sales: 0, cost: 0, purchases: 0, claimLoss: 0 };
      existing.claimLoss += claimLossAmount(row);
      map.set(day, existing);
    });

    return Array.from(map.entries())
      .map(([day, value]) => ({
        id: day,
        date: day,
        salesAmount: value.sales,
        costAmount: value.cost,
          purchaseAmount: value.purchases,
        claimLoss: value.claimLoss,
        profit: value.sales - value.cost - value.claimLoss,
          cashflow: value.sales - value.purchases - value.claimLoss,
        searchText: day,
      }))
      .sort((a, b) => b.date.localeCompare(a.date));
        }, [sales, purchases, products, claims]);

  const tabMeta = useMemo(
    () => ({
      sales: {
        title: "Sales Report",
        rows: salesRows,
        columns: [
          { key: "date", label: "Date", getValue: (row) => row.date },
          { key: "ref", label: "Invoice", getValue: (row) => row.ref },
          { key: "party", label: "Customer", getValue: (row) => row.party },
          { key: "generatedBy", label: "Generated By", getValue: (row) => row.generatedBy },
          { key: "status", label: "Status", getValue: (row) => row.status },
          { key: "items", label: "Items", getValue: (row) => row.items },
          { key: "total", label: "Total", getValue: (row) => currency.format(row.total) },
          { key: "paid", label: "Paid", getValue: (row) => currency.format(row.paid) },
          { key: "due", label: "Due", getValue: (row) => currency.format(row.due) },
        ],
        stats: (rows) => [
          { label: "Invoices", value: rows.length },
          { label: "Sales Total", value: currency.format(rows.reduce((sum, row) => sum + row.total, 0)) },
          { label: "Collected", value: currency.format(rows.reduce((sum, row) => sum + row.paid, 0)) },
          { label: "Outstanding", value: currency.format(rows.reduce((sum, row) => sum + row.due, 0)) },
        ],
      },
      purchases: {
        title: "Purchase Report",
        rows: purchaseRows,
        columns: [
          { key: "date", label: "Date", getValue: (row) => row.date },
          { key: "ref", label: "Invoice", getValue: (row) => row.ref },
          { key: "party", label: "Supplier", getValue: (row) => row.party },
          { key: "status", label: "Status", getValue: (row) => row.status },
          { key: "items", label: "Items", getValue: (row) => row.items },
          { key: "total", label: "Total", getValue: (row) => currency.format(row.total) },
          { key: "paid", label: "Paid", getValue: (row) => currency.format(row.paid) },
          { key: "due", label: "Due", getValue: (row) => currency.format(row.due) },
        ],
        stats: (rows) => [
          { label: "Purchases", value: rows.length },
          { label: "Purchase Total", value: currency.format(rows.reduce((sum, row) => sum + row.total, 0)) },
          { label: "Paid", value: currency.format(rows.reduce((sum, row) => sum + row.paid, 0)) },
          { label: "Payable", value: currency.format(rows.reduce((sum, row) => sum + row.due, 0)) },
        ],
      },
      dues: {
        title: "Dues Payment Report",
        rows: dueRows,
        columns: [
          { key: "date", label: "Date", getValue: (row) => row.date },
          { key: "direction", label: "Type", getValue: (row) => row.direction },
          { key: "invoice", label: "Invoice", getValue: (row) => row.invoice },
          { key: "invoiceType", label: "Invoice Type", getValue: (row) => row.invoiceType },
          { key: "party", label: "Party", getValue: (row) => row.party },
          { key: "collectedBy", label: "Collected By", getValue: (row) => row.collectedBy },
          { key: "method", label: "Method", getValue: (row) => row.method },
          { key: "amount", label: "Amount", getValue: (row) => currency.format(row.amount) },
        ],
        stats: (rows) => {
          const totalReceived = rows
            .filter((row) => row.direction === "received")
            .reduce((sum, row) => sum + row.amount, 0);
          const totalPaid = rows
            .filter((row) => row.direction === "paid")
            .reduce((sum, row) => sum + row.amount, 0);

          return [
            { label: "Transactions", value: rows.length },
            { label: "Total Received", value: currency.format(totalReceived) },
            { label: "Total Paid", value: currency.format(totalPaid) },
            { label: "Net Dues Cashflow", value: currency.format(totalReceived - totalPaid) },
          ];
        },
      },
      claims: {
        title: "Claims Report",
        rows: claimsRows,
        columns: [
          { key: "date", label: "Date", getValue: (row) => row.date },
          { key: "claimNumber", label: "Claim #", getValue: (row) => row.claimNumber },
          { key: "supplier", label: "Supplier", getValue: (row) => row.supplier },
          { key: "customer", label: "Customer", getValue: (row) => row.customer },
          { key: "product", label: "Product", getValue: (row) => row.product },
          { key: "quantity", label: "Qty", getValue: (row) => row.quantity },
          { key: "replacement", label: "Replacement", getValue: (row) => row.replacement },
          { key: "supplierStatus", label: "Supplier Status", getValue: (row) => row.supplierStatus },
          { key: "status", label: "Claim Status", getValue: (row) => row.status },
          { key: "lossImpact", label: "Loss Impact", getValue: (row) => currency.format(row.lossImpact) },
        ],
        stats: (rows) => [
          { label: "Claims", value: rows.length },
          {
            label: "Accepted",
            value: rows.filter((row) => row.status === "accepted").length,
          },
          {
            label: "Rejected",
            value: rows.filter((row) => row.status === "rejected").length,
          },
          {
            label: "Claim Loss Value",
            value: currency.format(rows.reduce((sum, row) => sum + row.lossImpact, 0)),
          },
        ],
      },
      stock: {
        title: "Stock Report",
        rows: stockRows,
        columns: [
          { key: "sku", label: "SKU", getValue: (row) => row.sku },
          { key: "name", label: "Product", getValue: (row) => row.name },
          { key: "category", label: "Category", getValue: (row) => row.category },
          { key: "stock", label: "In Stock", getValue: (row) => row.stock },
          { key: "minStock", label: "Min Stock", getValue: (row) => row.minStock },
          { key: "value", label: "Stock Value", getValue: (row) => currency.format(row.value) },
          { key: "date", label: "Updated", getValue: (row) => row.date || "-" },
        ],
        stats: (rows) => [
          { label: "Products", value: rows.length },
          { label: "Total Units", value: rows.reduce((sum, row) => sum + row.stock, 0) },
          {
            label: "Low Stock Items",
            value: rows.filter((row) => row.stock <= row.minStock).length,
          },
          { label: "Inventory Value", value: currency.format(rows.reduce((sum, row) => sum + row.value, 0)) },
        ],
      },
      customers: {
        title: "Customer Report",
        rows: customerRows,
        columns: [
          { key: "name", label: "Name", getValue: (row) => row.name },
          { key: "phone", label: "Phone", getValue: (row) => row.phone },
          { key: "address", label: "Address", getValue: (row) => row.address },
          { key: "balance", label: "Receivable", getValue: (row) => currency.format(row.balance) },
          { key: "state", label: "Status", getValue: (row) => row.state },
          { key: "date", label: "Joined", getValue: (row) => row.date || "-" },
        ],
        stats: (rows) => [
          { label: "Customers", value: rows.length },
          {
            label: "Active",
            value: rows.filter((row) => row.state === "active").length,
          },
          {
            label: "Due Customers",
            value: rows.filter((row) => row.balance > 0).length,
          },
          { label: "Total Receivable", value: currency.format(rows.reduce((sum, row) => sum + row.balance, 0)) },
        ],
      },
      suppliers: {
        title: "Supplier Report",
        rows: supplierRows,
        columns: [
          { key: "name", label: "Name", getValue: (row) => row.name },
          { key: "phone", label: "Phone", getValue: (row) => row.phone },
          { key: "address", label: "Address", getValue: (row) => row.address },
          { key: "payable", label: "Payable", getValue: (row) => currency.format(row.payable) },
          { key: "state", label: "Status", getValue: (row) => row.state },
          { key: "date", label: "Added", getValue: (row) => row.date || "-" },
        ],
        stats: (rows) => [
          { label: "Suppliers", value: rows.length },
          {
            label: "Active",
            value: rows.filter((row) => row.state === "active").length,
          },
          {
            label: "With Payable",
            value: rows.filter((row) => row.payable > 0).length,
          },
          { label: "Total Payable", value: currency.format(rows.reduce((sum, row) => sum + row.payable, 0)) },
        ],
      },
      profit: {
        title: "Profit Report",
        rows: profitRows,
        columns: [
          { key: "date", label: "Date", getValue: (row) => row.date },
          { key: "salesAmount", label: "Sales", getValue: (row) => currency.format(row.salesAmount) },
          {
            key: "purchaseAmount",
            label: "Purchases",
            getValue: (row) => currency.format(row.purchaseAmount),
          },
          {
            key: "costAmount",
            label: "COGS",
            getValue: (row) => currency.format(row.costAmount),
          },
          {
            key: "claimLoss",
            label: "Claim Loss",
            getValue: (row) => currency.format(row.claimLoss),
          },
          { key: "cashflow", label: "Cashflow", getValue: (row) => currency.format(row.cashflow) },
          { key: "profit", label: "Net Profit", getValue: (row) => currency.format(row.profit) },
        ],
        stats: (rows) => [
          { label: "Days", value: rows.length },
          {
            label: "Sales",
            value: currency.format(rows.reduce((sum, row) => sum + row.salesAmount, 0)),
          },
          {
            label: "Costs",
            value: currency.format(
              rows.reduce((sum, row) => sum + row.costAmount + row.claimLoss, 0)
            ),
          },
          {
            label: "Purchases",
            value: currency.format(rows.reduce((sum, row) => sum + row.purchaseAmount, 0)),
          },
          {
            label: "Claim Loss",
            value: currency.format(rows.reduce((sum, row) => sum + row.claimLoss, 0)),
          },
          {
            label: "Cashflow",
            value: currency.format(rows.reduce((sum, row) => sum + row.cashflow, 0)),
          },
          { label: "Net Profit", value: currency.format(rows.reduce((sum, row) => sum + row.profit, 0)) },
        ],
      },
    }),
    [
      salesRows,
      purchaseRows,
      dueRows,
      claimsRows,
      stockRows,
      customerRows,
      supplierRows,
      profitRows,
    ]
  );

  const activeMeta = tabMeta[activeTab];

  const filteredRows = useMemo(() => {
    const query = search.trim().toLowerCase();

    return activeMeta.rows.filter((row) => {
      const searchMatched = !query || row.searchText.toLowerCase().includes(query);
      const dateMatched = matchesDateRange(row.date, fromDate, toDate);
      return searchMatched && dateMatched;
    });
  }, [activeMeta, search, fromDate, toDate]);

  const totalPages = Math.max(1, Math.ceil(filteredRows.length / PAGE_SIZE));

  const paginatedRows = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredRows.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredRows, page]);

  const stats = useMemo(() => activeMeta.stats(filteredRows), [activeMeta, filteredRows]);

  const pageRange = useMemo(() => {
    const spread = 2;
    const start = Math.max(1, page - spread);
    const end = Math.min(totalPages, page + spread);
    const pages = [];

    for (let value = start; value <= end; value += 1) {
      pages.push(value);
    }

    return pages;
  }, [page, totalPages]);

  const selectedCount = filteredRows.filter((row) => selectedIds.has(row.id)).length;

  const allVisibleSelected =
    paginatedRows.length > 0 && paginatedRows.every((row) => selectedIds.has(row.id));

  const toggleRow = (rowId) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(rowId)) {
        next.delete(rowId);
      } else {
        next.add(rowId);
      }
      return next;
    });
  };

  const toggleVisibleRows = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);

      if (allVisibleSelected) {
        paginatedRows.forEach((row) => next.delete(row.id));
      } else {
        paginatedRows.forEach((row) => next.add(row.id));
      }

      return next;
    });
  };

  const exportSelected = async () => {
    const selectedRows = filteredRows.filter((row) => selectedIds.has(row.id));

    if (selectedRows.length === 0) {
      setError("Please select at least one row to export");
      setNotice("");
      return;
    }

    try {
      const stamp = new Date().toISOString().slice(0, 10);
      const filename = `${activeTab}-report-${stamp}.xlsx`;
      await downloadStyledWorkbook({
        filename,
        reportTitle: activeMeta.title,
        columns: activeMeta.columns,
        rows: selectedRows,
      });
      setNotice(`${selectedRows.length} records exported in professional Excel format`);
      setError("");
    } catch (exportError) {
      setError(exportError?.message || "Failed to export report");
      setNotice("");
    }
  };

  const showingFrom = filteredRows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredRows.length);

  return (
    <Layout title="Reports">
      <div className="reports-wrap">
        <section className="sales-hero">
          <div>
            <p className="hero-eyebrow">Reports Desk</p>
            <h2>Analyze every business module with filters, selection controls, and export-ready lists</h2>
            {activeTab === "profit" ? (
              <p className="editor-subtitle">
                Net profit includes claim impact from pending, sent to supplier, and rejected claims.
              </p>
            ) : null}
          </div>
          <button type="button" className="primary-btn" onClick={exportSelected}>
            Export Selected
          </button>
        </section>

        <section className="reports-tabs" aria-label="Report tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`report-tab-btn ${activeTab === tab.id ? "active" : ""}`}
              onClick={() => setActiveTab(tab.id)}
            >
              {tab.label}
            </button>
          ))}
        </section>

        <section className="reports-toolbar">
          <input
            type="search"
            placeholder={`Search in ${activeMeta.title.toLowerCase()}`}
            value={search}
            onChange={(event) => {
              setSearch(event.target.value);
              setError("");
              setNotice("");
            }}
          />
          <input
            type="date"
            value={fromDate}
            onChange={(event) => {
              setFromDate(event.target.value);
              setError("");
              setNotice("");
            }}
            aria-label="From date"
          />
          <input
            type="date"
            value={toDate}
            onChange={(event) => {
              setToDate(event.target.value);
              setError("");
              setNotice("");
            }}
            aria-label="To date"
          />
          <button
            type="button"
            className="ghost-btn"
            onClick={() => {
              setSearch("");
              setFromDate("");
              setToDate("");
            }}
          >
            Clear Filters
          </button>
        </section>

        <section className="sales-kpis">
          {stats.map((stat) => (
            <article key={stat.label} className="product-stat-card">
              <p>{stat.label}</p>
              <h3>{stat.value}</h3>
            </article>
          ))}
        </section>

        {notice ? <p key={noticeKey} className="success-text">{notice}</p> : null}
        {error ? <p key={errorKey} className="error-text">{error}</p> : null}

        <section className="products-table-card">
          {loading ? (
            <p>Loading reports...</p>
          ) : (
            <>
              <div className="report-selection-bar">
                <label className="check-inline" htmlFor="toggle-page-select">
                  <input
                    id="toggle-page-select"
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleVisibleRows}
                  />
                  Select all rows on this page
                </label>
                <p>
                  {selectedCount} selected in filtered list
                </p>
              </div>

              <div className="products-table-scroll">
                <table className="products-table">
                  <thead>
                    <tr>
                      <th>Select</th>
                      {activeMeta.columns.map((column) => (
                        <th key={column.key}>{column.label}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filteredRows.length === 0 ? (
                      <tr>
                        <td colSpan={activeMeta.columns.length + 1}>No records found for this report.</td>
                      </tr>
                    ) : (
                      paginatedRows.map((row) => (
                        <tr key={row.id}>
                          <td>
                            <input
                              type="checkbox"
                              checked={selectedIds.has(row.id)}
                              onChange={() => toggleRow(row.id)}
                              aria-label={`Select row ${row.id}`}
                            />
                          </td>
                          {activeMeta.columns.map((column) => {
                            const rawValue = column.getValue(row);

                            if (column.key === "status" || column.key === "state" || column.key === "direction") {
                              const normalized = String(rawValue).toLowerCase();
                              const tone = ["active", "paid", "accepted", "received", "closed"].includes(normalized);
                              return (
                                <td key={column.key}>
                                  <span className={`report-status ${tone ? "ok" : "warn"}`}>
                                    {String(rawValue).toUpperCase()}
                                  </span>
                                </td>
                              );
                            }

                            if (column.key === "supplierStatus") {
                              const normalized = String(rawValue).toLowerCase();
                              const tone = normalized === "accepted";
                              return (
                                <td key={column.key}>
                                  <span className={`report-status ${tone ? "ok" : "warn"}`}>
                                    {String(rawValue).toUpperCase()}
                                  </span>
                                </td>
                              );
                            }

                            if (column.key === "date") {
                              return (
                                <td key={column.key}>
                                  {row.date ? dateShort.format(new Date(row.date)) : "-"}
                                </td>
                              );
                            }

                            return <td key={column.key}>{rawValue}</td>;
                          })}
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {filteredRows.length > PAGE_SIZE ? (
                <div className="table-pagination">
                  <p>
                    Showing {showingFrom}-{showingTo} of {filteredRows.length}
                  </p>
                  <div className="pagination-controls">
                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={page === 1}
                      onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                    >
                      Previous
                    </button>

                    {pageRange.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`page-btn ${pageNumber === page ? "active" : ""}`}
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}

                    <button
                      type="button"
                      className="ghost-btn"
                      disabled={page === totalPages}
                      onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
                    >
                      Next
                    </button>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </section>
      </div>
    </Layout>
  );
};

export default ReportsPage;
