import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import client from "../api/client";
import useToastMessage from "../hooks/useToastMessage";
import { useSmartPopup } from "../components/SmartPopupProvider";

const PAGE_SIZE = 10;
const SETTINGS_STORAGE_KEY = "hafizg_settings_v1";
const allowedPaymentMethods = new Set(["cash", "bank", "card", "upi", "other"]);
const paymentMethodOptions = [
  { value: "cash", label: "Cash" },
  { value: "bank", label: "Bank" },
  { value: "card", label: "Card" },
  { value: "upi", label: "UPI" },
  { value: "other", label: "Other" },
];

const currency = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const dateShort = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
});

const timeOnly = new Intl.DateTimeFormat("en-PK", {
  timeStyle: "short",
});

const getTodayLocalDate = () => {
  const now = new Date();
  const localTime = new Date(now.getTime() - now.getTimezoneOffset() * 60000);
  return localTime.toISOString().slice(0, 10);
};

const emptyItem = {
  productId: "",
  productQuery: "",
  quantity: "1",
  unitPrice: "",
};

const getDefaultPaymentMethod = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);

    if (!raw) {
      return "cash";
    }

    const parsed = JSON.parse(raw);
    const method = String(parsed?.billing?.defaultPaymentMethod || "cash").toLowerCase();
    return allowedPaymentMethods.has(method) ? method : "cash";
  } catch (_error) {
    return "cash";
  }
};

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

const buildEmptyForm = () => ({
  customerId: "",
  customerQuery: "",
  date: getTodayLocalDate(),
  items: [{ ...emptyItem }],
  discount: "0",
  tax: "0",
  paymentMethod: getDefaultPaymentMethod(),
  paymentStatus: "paid",
  paidAmount: "",
});

const formatSalesModalError = (message) => {
  const safeMessage = String(message || "");

  if (safeMessage.startsWith("Insufficient stock for:") && safeMessage.includes(";")) {
    const details = safeMessage.replace("Insufficient stock for:", "").trim();
    const lines = details
      .split(";")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `- ${line}`)
      .join("\n");

    return `Insufficient stock for the following items:\n${lines}`;
  }

  return safeMessage;
};

const SalesPage = () => {
  const minBillingDate = getTodayLocalDate();
  const storeName = useMemo(() => getStoreNameFromSettings(), []);
  const navigate = useNavigate();
  const popup = useSmartPopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settlingPayment, setSettlingPayment] = useState(false);
  const [sales, setSales] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [products, setProducts] = useState([]);
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedInvoice, setSelectedInvoice] = useState(null);
  const [modalError, setModalError] = useState("");
  const [form, setForm] = useState(buildEmptyForm());
  const [customerOptionsOpen, setCustomerOptionsOpen] = useState(false);
  const [productOptionsOpenIndex, setProductOptionsOpenIndex] = useState(null);

  const loadBase = async () => {
    try {
      setLoading(true);
      setError("");

      const [salesRes, customersRes, productsRes] = await Promise.all([
        client.get("/sales"),
        client.get("/customers"),
        client.get("/products"),
      ]);

      setSales(salesRes.data?.data || []);
      setCustomers(customersRes.data?.data || []);
      setProducts(productsRes.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load sales page");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (!builderOpen && !viewOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (builderOpen) {
          closeBuilder();
        }
        if (viewOpen) {
          closeView();
        }
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [builderOpen, viewOpen, form, saving]);

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const productById = useMemo(() => {
    return products.reduce((acc, product) => {
      acc[product._id] = product;
      return acc;
    }, {});
  }, [products]);

  const stats = useMemo(() => {
    const now = new Date();
    const isToday = (value) => {
      const date = new Date(value);
      return (
        date.getFullYear() === now.getFullYear() &&
        date.getMonth() === now.getMonth() &&
        date.getDate() === now.getDate()
      );
    };

    const todaySales = sales.filter((invoice) => isToday(invoice.date));
    const todayRevenue = todaySales.reduce((sum, invoice) => sum + Number(invoice.grandTotal || 0), 0);
    const todayCollected = todaySales.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0);
    const outstanding = sales.reduce(
      (sum, invoice) => sum + Math.max(0, Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0)),
      0
    );

    return {
      todayInvoices: todaySales.length,
      todayRevenue,
      todayCollected,
      outstanding,
    };
  }, [sales]);

  const filteredSales = useMemo(() => {
    return sales.filter((invoice) => {
      const q = search.trim().toLowerCase();
      const customerName = invoice.customerId?.name?.toLowerCase() || "";
      const invoiceNumber = invoice.invoiceNumber?.toLowerCase() || "";
      const generatedBy =
        resolveGeneratedByLabel(invoice, storeName).toLowerCase();

      const searchMatched =
        !q ||
        customerName.includes(q) ||
        invoiceNumber.includes(q) ||
        generatedBy.includes(q) ||
        String(invoice._id).includes(q);

      const statusMatched = !statusFilter || invoice.paymentStatus === statusFilter;

      return searchMatched && statusMatched;
    });
  }, [sales, search, statusFilter, storeName]);

  const totalPages = Math.max(1, Math.ceil(filteredSales.length / PAGE_SIZE));

  const paginatedSales = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredSales.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredSales, page]);

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

  const invoiceTotals = useMemo(() => {
    const normalizedItems = form.items.map((item) => {
      const quantity = Math.max(0, Number(item.quantity || 0));
      const fallbackPrice = Number(productById[item.productId]?.salePrice || 0);
      const unitPrice = item.unitPrice === "" ? fallbackPrice : Math.max(0, Number(item.unitPrice || 0));
      const subtotal = Number((quantity * unitPrice).toFixed(2));

      return {
        ...item,
        quantity,
        unitPrice,
        subtotal,
      };
    });

    const subtotal = Number(
      normalizedItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)
    );
    const discount = Math.max(0, Number(form.discount || 0));
    const tax = Math.max(0, Number(form.tax || 0));
    const grandTotal = Number(Math.max(0, subtotal - discount + tax).toFixed(2));

    let paidAmount = 0;
    if (form.paymentStatus === "paid") {
      paidAmount = grandTotal;
    } else if (form.paymentStatus === "partial") {
      paidAmount = Number(Math.min(grandTotal, Math.max(0, Number(form.paidAmount || 0))).toFixed(2));
    }

    const dueAmount = Number((grandTotal - paidAmount).toFixed(2));

    return {
      normalizedItems,
      subtotal,
      discount,
      tax,
      grandTotal,
      paidAmount,
      dueAmount,
    };
  }, [form, productById]);

  const hasInvoiceDraftChanges = useMemo(() => {
    const baseline = buildEmptyForm();
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form]);

  const openBuilder = () => {
    setForm(buildEmptyForm());
    setBuilderOpen(true);
    setModalError("");
    setNotice("");
    setError("");
  };

  const closeBuilder = async (force = false) => {
    if (saving) {
      return;
    }

    if (!force && hasInvoiceDraftChanges) {
      const shouldDiscard = await popup.confirm({
        title: "Discard Invoice Draft",
        message: "You have unsaved invoice changes. Discard this invoice draft?",
        confirmText: "Discard",
      });

      if (!shouldDiscard) {
        return;
      }
    }

    setBuilderOpen(false);
    setForm(buildEmptyForm());
    setModalError("");
    setError("");
  };

  const openView = (invoice) => {
    setSelectedInvoice(invoice);
    setViewOpen(true);
    setError("");
  };

  const closeView = () => {
    setSelectedInvoice(null);
    setViewOpen(false);
    setError("");
  };

  const printInvoice = (invoice) => {
    if (!invoice?._id) {
      return;
    }

    navigate(`/sales/${invoice._id}/print`);
  };

  const onFieldChange = (key, value) => {
    setForm((prev) => {
      if (key === "customerQuery") {
        const query = String(value || "").trim().toLowerCase();
        const selected = customers.find((customer) => customer.name?.trim().toLowerCase() === query);

        return {
          ...prev,
          customerQuery: value,
          customerId: selected?._id || "",
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const filteredCustomersForSearch = useMemo(() => {
    const query = (form.customerQuery || "").trim().toLowerCase();

    if (!query) {
      return [];
    }

    return customers
      .filter((customer) => {
        const name = (customer.name || "").toLowerCase();
        const phone = (customer.phone || "").toLowerCase();
        return name.includes(query) || phone.includes(query);
      })
      .slice(0, 8);
  }, [customers, form.customerQuery]);

  const selectCustomer = (customer) => {
    setForm((prev) => ({
      ...prev,
      customerId: customer._id,
      customerQuery: customer.name || "",
    }));
    setCustomerOptionsOpen(false);
  };

  const filteredProductsForLine = (line) => {
    const query = (line?.productQuery || "").trim().toLowerCase();

    if (!query) {
      return [];
    }

    return products
      .filter((product) => {
        const name = (product.name || "").toLowerCase();
        return name.includes(query);
      })
      .slice(0, 8);
  };

  const selectProductForLine = (lineIndex, product) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((line, index) => {
        if (index !== lineIndex) {
          return line;
        }

        return {
          ...line,
          productId: product._id,
          productQuery: product.name || "",
          unitPrice: String(product.salePrice || ""),
        };
      }),
    }));

    setProductOptionsOpenIndex(null);
  };

  const onLineChange = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((line, lineIndex) => {
        if (lineIndex !== index) {
          return line;
        }

        const next = { ...line, [key]: value };
        if (key === "productId") {
          const selected = productById[value];
          next.productQuery = selected?.name || "";
          next.unitPrice = selected ? String(selected.salePrice || "") : "";
        }

        if (key === "productQuery") {
          const query = String(value || "").trim().toLowerCase();
          const selected = products.find((product) => product.name?.trim().toLowerCase() === query);

          next.productId = selected?._id || "";
          if (selected) {
            next.unitPrice = String(selected.salePrice || "");
          }
        }

        return next;
      }),
    }));
  };

  const addLine = () => {
    setForm((prev) => ({
      ...prev,
      items: [...prev.items, { ...emptyItem }],
    }));
  };

  const removeLine = (index) => {
    setForm((prev) => {
      if (prev.items.length <= 1) {
        return prev;
      }

      return {
        ...prev,
        items: prev.items.filter((_, lineIndex) => lineIndex !== index),
      };
    });
  };

  const submitInvoice = async (event) => {
    event.preventDefault();

    const today = getTodayLocalDate();

    if (form.date !== today) {
      setModalError("Invoice date must be today");
      return;
    }

    if (form.date < minBillingDate) {
      setModalError("Invoice date cannot be in the past");
      return;
    }

    if (!form.customerId) {
      setModalError("Customer is required. Please search and select a customer from the list");
      return;
    }

    const hasInvalidLine = invoiceTotals.normalizedItems.some(
      (item) => !item.productId || item.quantity <= 0
    );

    if (hasInvalidLine) {
      setModalError("Each line must have a product and quantity greater than zero");
      return;
    }

    try {
      setSaving(true);
      setModalError("");
      setNotice("");

      const payload = {
        customerId: form.customerId || null,
        date: new Date(form.date),
        items: invoiceTotals.normalizedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        discount: invoiceTotals.discount,
        tax: invoiceTotals.tax,
        paymentMethod: form.paymentMethod,
        paymentStatus: form.paymentStatus,
        paidAmount: invoiceTotals.paidAmount,
      };

      await client.post("/sales", payload);
      setNotice("Sale invoice created successfully");
      await closeBuilder(true);
      await loadBase();
      setPage(1);
    } catch (saveError) {
      const message = saveError.response?.data?.message || "Failed to create sale invoice";
      setModalError(formatSalesModalError(message));
    } finally {
      setSaving(false);
    }
  };

  const settleInvoicePayment = async () => {
    if (!selectedInvoice || settlingPayment) {
      return;
    }

    const dueAmount = Number(
      Math.max(0, Number(selectedInvoice.grandTotal || 0) - Number(selectedInvoice.paidAmount || 0)).toFixed(2)
    );

    if (dueAmount <= 0) {
      setNotice("Invoice is already fully paid");
      return;
    }

    const value = await popup.prompt({
      title: "Collect Payment",
      message: `Enter collected amount (max ${dueAmount}):`,
      inputType: "number",
      initialValue: String(dueAmount),
      min: 0.01,
      max: dueAmount,
      step: 0.01,
      required: true,
      confirmText: "Record",
      validate: (raw) => {
        const amount = Number(raw);

        if (!Number.isFinite(amount) || amount <= 0) {
          return "Enter a valid payment amount";
        }

        if (amount > dueAmount) {
          return `Maximum allowed is ${dueAmount}`;
        }

        return "";
      },
    });

    if (value === null) {
      return;
    }

    const amount = Number(value);

    if (!Number.isFinite(amount) || amount <= 0 || amount > dueAmount) {
      return;
    }

    const method = await popup.prompt({
      title: "Payment Method",
      message: "Select payment method for this due collection:",
      inputType: "select",
      inputOptions: paymentMethodOptions,
      initialValue: selectedInvoice.paymentMethod || "cash",
      required: true,
      confirmText: "Continue",
    });

    if (method === null) {
      return;
    }

    try {
      setSettlingPayment(true);
      setError("");

      const response = await client.patch(`/sales/${selectedInvoice._id}/payment`, {
        amount,
        paymentMethod: method,
      });

      const updatedInvoice = response.data?.data;
      if (updatedInvoice) {
        setSelectedInvoice(updatedInvoice);
      }

      await loadBase();
      const remaining = Math.max(0, dueAmount - amount);
      setNotice(remaining > 0 ? `Payment recorded. Remaining due: ${currency.format(remaining)}` : "Invoice cleared successfully");
    } catch (paymentError) {
      setError(paymentError.response?.data?.message || "Failed to record payment");
    } finally {
      setSettlingPayment(false);
    }
  };

  const showingFrom = filteredSales.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredSales.length);

  const invoiceItems = selectedInvoice?.items || [];

  return (
    <Layout title="Sales / Billing">
      <div className="sales-wrap">
        <section className="sales-hero">
          <div>
            <p className="hero-eyebrow">Revenue Desk</p>
            <h2>Create invoices, track collections, and monitor dues in real time</h2>
          </div>
          <button type="button" className="primary-btn" onClick={openBuilder}>
            New Invoice
          </button>
        </section>

        <div className="sales-kpis">
          <article className="product-stat-card">
            <p>Invoices Today</p>
            <h3>{stats.todayInvoices}</h3>
          </article>
          <article className="product-stat-card">
            <p>Today Revenue</p>
            <h3>{currency.format(stats.todayRevenue)}</h3>
          </article>
          <article className="product-stat-card">
            <p>Today Collected</p>
            <h3>{currency.format(stats.todayCollected)}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>Outstanding Receivables</p>
            <h3>{currency.format(stats.outstanding)}</h3>
          </article>
        </div>

        <section className="sales-filters">
          <input
            type="search"
            placeholder="Search by invoice number or customer"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All Status</option>
            <option value="paid">Paid</option>
            <option value="partial">Partial</option>
            <option value="unpaid">Unpaid</option>
          </select>
        </section>

        {notice ? <p key={noticeKey} className="success-text">{notice}</p> : null}
        {!builderOpen && !viewOpen && error ? <p key={errorKey} className="error-text">{error}</p> : null}

        <section className="products-table-card">
          {loading ? (
            <p>Loading sales...</p>
          ) : (
            <div className="products-table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Customer</th>
                    <th>Generated By</th>
                    <th>Items</th>
                    <th>Grand Total</th>
                    <th>Paid</th>
                    <th>Due</th>
                    <th>Method</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSales.length === 0 ? (
                    <tr>
                      <td colSpan="11">No invoices found.</td>
                    </tr>
                  ) : (
                    paginatedSales.map((invoice) => {
                      const due = Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0);
                      const generatedBy = resolveGeneratedByLabel(invoice, storeName);
                      return (
                        <tr key={invoice._id}>
                          <td>{invoice.invoiceNumber}</td>
                          <td>{dateShort.format(new Date(invoice.date))}</td>
                          <td>{invoice.customerId?.name || "Walk-in Customer"}</td>
                          <td>{generatedBy}</td>
                          <td>{invoice.items?.length || 0}</td>
                          <td>{currency.format(Number(invoice.grandTotal || 0))}</td>
                          <td>{currency.format(Number(invoice.paidAmount || 0))}</td>
                          <td>{currency.format(Math.max(0, due))}</td>
                          <td>{invoice.paymentMethod?.toUpperCase() || "-"}</td>
                          <td>
                            <span className={`payment-pill ${invoice.paymentStatus || "unpaid"}`}>
                              {invoice.paymentStatus || "unpaid"}
                            </span>
                          </td>
                          <td className="table-actions">
                            <button type="button" onClick={() => openView(invoice)}>
                              View
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredSales.length > PAGE_SIZE ? (
            <div className="table-pagination">
              <p>
                Showing {showingFrom}-{showingTo} of {filteredSales.length}
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
        </section>

        {builderOpen ? (
          <div className="editor-modal" role="dialog" aria-modal="true">
            <button
              className="editor-backdrop"
              type="button"
              onClick={() => {
                closeBuilder();
              }}
              aria-label="Close"
            />
            <section className="editor-card modal sales-modal-card">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Invoice Builder</p>
                  <h3>Create Sale Invoice</h3>
                  <p className="editor-subtitle">
                    Build invoice lines, set payment mode, and post stock-adjusted sales instantly.
                  </p>
                </div>
                <button
                  type="button"
                  className="ghost-btn"
                  onClick={() => {
                    closeBuilder();
                  }}
                >
                  Close
                </button>
              </div>

              <form className="editor-form sales-form" onSubmit={submitInvoice}>
                {modalError ? <p className="sales-modal-error">{modalError}</p> : null}

                <label>
                  Customer
                  <div className="sales-search-field">
                    <input
                      required
                      placeholder="Search customer name"
                      value={form.customerQuery || ""}
                      onFocus={() => setCustomerOptionsOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setCustomerOptionsOpen(false);
                        }, 120);
                      }}
                      onChange={(event) => {
                        onFieldChange("customerQuery", event.target.value);
                        setCustomerOptionsOpen(true);
                      }}
                    />

                    {customerOptionsOpen && (form.customerQuery || "").trim() ? (
                      <div className="sales-search-dropdown" role="listbox" aria-label="Customers">
                        {filteredCustomersForSearch.length === 0 ? (
                          <p className="sales-search-empty">No customers found</p>
                        ) : (
                          filteredCustomersForSearch.map((customer) => (
                            <button
                              key={customer._id}
                              type="button"
                              className="sales-search-option"
                              onMouseDown={() => selectCustomer(customer)}
                            >
                              <span>{customer.name}</span>
                              {customer.phone ? <small>{customer.phone}</small> : null}
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </label>

                <label>
                  Invoice Date
                  <input
                    type="date"
                    required
                    min={minBillingDate}
                    max={minBillingDate}
                    value={form.date}
                    onChange={(event) => onFieldChange("date", event.target.value)}
                    disabled
                  />
                </label>

                <section className="sales-lines">
                  <div className="sales-lines-head">
                    <h4>Invoice Items</h4>
                    <button type="button" className="ghost-btn" onClick={addLine}>
                      Add Line
                    </button>
                  </div>

                  <div className="sales-lines-grid">
                    {form.items.map((line, index) => (
                      <div key={`line-${index}`} className="sales-line-row">
                        <label>
                          Product
                          <div className="sales-search-field">
                            <input
                              required
                              placeholder="Search product"
                              value={line.productQuery || ""}
                              onFocus={() => setProductOptionsOpenIndex(index)}
                              onBlur={() => {
                                window.setTimeout(() => {
                                  setProductOptionsOpenIndex((prev) => (prev === index ? null : prev));
                                }, 120);
                              }}
                              onChange={(event) => {
                                onLineChange(index, "productQuery", event.target.value);
                                setProductOptionsOpenIndex(index);
                              }}
                            />

                            {productOptionsOpenIndex === index && (line.productQuery || "").trim() ? (
                              <div className="sales-search-dropdown" role="listbox" aria-label="Products">
                                {filteredProductsForLine(line).length === 0 ? (
                                  <p className="sales-search-empty">No products found</p>
                                ) : (
                                  filteredProductsForLine(line).map((product) => (
                                    <button
                                      key={product._id}
                                      type="button"
                                      className="sales-search-option"
                                      onMouseDown={() => selectProductForLine(index, product)}
                                    >
                                      <span>{product.name}</span>
                                    </button>
                                  ))
                                )}
                              </div>
                            ) : null}
                          </div>
                        </label>

                        <label>
                          Quantity
                          <input
                            required
                            type="number"
                            min="1"
                            step="1"
                            value={line.quantity}
                            onChange={(event) => onLineChange(index, "quantity", event.target.value)}
                          />
                        </label>

                        <label>
                          Unit Price
                          <input
                            required
                            type="number"
                            min="0"
                            step="0.01"
                            value={line.unitPrice}
                            onChange={(event) => onLineChange(index, "unitPrice", event.target.value)}
                          />
                        </label>

                        <button
                          type="button"
                          className="ghost-btn line-remove-btn"
                          disabled={form.items.length <= 1}
                          onClick={() => removeLine(index)}
                        >
                          Remove
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                <label>
                  Discount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.discount}
                    onChange={(event) => onFieldChange("discount", event.target.value)}
                  />
                </label>

                <label>
                  Tax
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.tax}
                    onChange={(event) => onFieldChange("tax", event.target.value)}
                  />
                </label>

                <label>
                  Payment Method
                  <select
                    value={form.paymentMethod}
                    onChange={(event) => onFieldChange("paymentMethod", event.target.value)}
                  >
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>
                  Payment Status
                  <select
                    value={form.paymentStatus}
                    onChange={(event) => onFieldChange("paymentStatus", event.target.value)}
                  >
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="unpaid">Unpaid</option>
                  </select>
                </label>

                <label>
                  Paid Amount
                  <input
                    type="number"
                    min="0"
                    step="0.01"
                    value={
                      form.paymentStatus === "paid"
                        ? String(invoiceTotals.grandTotal)
                        : form.paymentStatus === "unpaid"
                          ? "0"
                          : form.paidAmount
                    }
                    disabled={form.paymentStatus !== "partial"}
                    onChange={(event) => onFieldChange("paidAmount", event.target.value)}
                  />
                </label>

                <section className="sales-summary-card">
                  <p>
                    <span>Subtotal</span>
                    <strong>{currency.format(invoiceTotals.subtotal)}</strong>
                  </p>
                  <p>
                    <span>Grand Total</span>
                    <strong>{currency.format(invoiceTotals.grandTotal)}</strong>
                  </p>
                  <p>
                    <span>Paid</span>
                    <strong>{currency.format(invoiceTotals.paidAmount)}</strong>
                  </p>
                  <p>
                    <span>Due</span>
                    <strong>{currency.format(invoiceTotals.dueAmount)}</strong>
                  </p>
                </section>

                <div className="editor-actions">
                  <button
                    type="button"
                    className="ghost-btn"
                    onClick={() => {
                      closeBuilder();
                    }}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? "Saving..." : "Create Invoice"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {viewOpen && selectedInvoice ? (
          <div className="editor-modal" role="dialog" aria-modal="true">
            <button className="editor-backdrop" type="button" onClick={closeView} aria-label="Close" />
            <section className="editor-card modal sales-view-card">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Invoice Preview</p>
                  <h3>{selectedInvoice.invoiceNumber}</h3>
                  <p className="editor-subtitle">
                    {dateShort.format(new Date(selectedInvoice.date))} •
                    {" "}
                    {timeOnly.format(new Date(selectedInvoice.createdAt || selectedInvoice.date))} •
                    {" "}
                    {selectedInvoice.customerId?.name || "Walk-in Customer"}
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={closeView}>
                  Close
                </button>
              </div>

              <div className="invoice-view-body">
                <div className="invoice-kpi-grid">
                  <article className="detail-mini-card">
                    <p>Subtotal</p>
                    <h4>{currency.format(Number(selectedInvoice.subtotal || 0))}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Grand Total</p>
                    <h4>{currency.format(Number(selectedInvoice.grandTotal || 0))}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Paid</p>
                    <h4>{currency.format(Number(selectedInvoice.paidAmount || 0))}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Due</p>
                    <h4>
                      {currency.format(
                        Math.max(
                          0,
                          Number(selectedInvoice.grandTotal || 0) - Number(selectedInvoice.paidAmount || 0)
                        )
                      )}
                    </h4>
                  </article>
                </div>

                <p className="invoice-meta-row">
                  Payment: {(selectedInvoice.paymentMethod || "cash").toUpperCase()} • Status: {selectedInvoice.paymentStatus || "unpaid"}
                </p>
                <p className="invoice-meta-row">
                  Generated By: {resolveGeneratedByLabel(selectedInvoice, storeName)}
                </p>

                <div className="products-table-scroll">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Quantity</th>
                        <th>Unit Price</th>
                        <th>Subtotal</th>
                      </tr>
                    </thead>
                    <tbody>
                      {invoiceItems.map((item, index) => (
                        <tr key={`${selectedInvoice._id}-item-${index}`}>
                          <td>{item.productId?.name || "-"}</td>
                          <td>{item.quantity}</td>
                          <td>{currency.format(Number(item.unitPrice || 0))}</td>
                          <td>{currency.format(Number(item.subtotal || 0))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={closeView}>
                    Close
                  </button>
                  {Math.max(
                    0,
                    Number(selectedInvoice.grandTotal || 0) - Number(selectedInvoice.paidAmount || 0)
                  ) > 0 ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={settleInvoicePayment}
                      disabled={settlingPayment}
                    >
                      {settlingPayment ? "Recording..." : "Collect Due"}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={() => printInvoice(selectedInvoice)}
                  >
                    Print Invoice
                  </button>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </Layout>
  );
};

export default SalesPage;
