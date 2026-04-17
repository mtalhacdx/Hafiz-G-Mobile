import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import client from "../api/client";
import useToastMessage from "../hooks/useToastMessage";
import { useSmartPopup } from "../components/SmartPopupProvider";

const PAGE_SIZE = 10;
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

const dateTime = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
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

const buildEmptyForm = () => ({
  supplierId: "",
  supplierQuery: "",
  date: getTodayLocalDate(),
  items: [{ ...emptyItem }],
  paymentStatus: "unpaid",
  paidAmount: "0",
});

const PurchasesPage = () => {
  const navigate = useNavigate();
  const minBillingDate = getTodayLocalDate();
  const popup = useSmartPopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settlingPayment, setSettlingPayment] = useState(false);
  const [purchases, setPurchases] = useState([]);
  const [suppliers, setSuppliers] = useState([]);
  const [products, setProducts] = useState([]);
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState(null);
  const [form, setForm] = useState(buildEmptyForm());
  const [supplierOptionsOpen, setSupplierOptionsOpen] = useState(false);
  const [productOptionsOpenIndex, setProductOptionsOpenIndex] = useState(null);

  const loadBase = async () => {
    try {
      setLoading(true);
      setError("");

      const [purchaseRes, supplierRes, productRes] = await Promise.all([
        client.get("/purchases"),
        client.get("/suppliers"),
        client.get("/products"),
      ]);

      setPurchases(purchaseRes.data?.data || []);
      setSuppliers(supplierRes.data?.data || []);
      setProducts(productRes.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load purchases page");
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

    const todayPurchases = purchases.filter((invoice) => isToday(invoice.date));
    const todayPurchaseCost = todayPurchases.reduce(
      (sum, invoice) => sum + Number(invoice.totalAmount || 0),
      0
    );
    const todayPaid = todayPurchases.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0);
    const outstandingPayables = purchases.reduce(
      (sum, invoice) =>
        sum + Math.max(0, Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0)),
      0
    );

    return {
      todayInvoices: todayPurchases.length,
      todayPurchaseCost,
      todayPaid,
      outstandingPayables,
    };
  }, [purchases]);

  const filteredPurchases = useMemo(() => {
    return purchases.filter((invoice) => {
      const q = search.trim().toLowerCase();
      const supplierName = invoice.supplierId?.name?.toLowerCase() || "";
      const invoiceNumber = invoice.purchaseInvoiceNumber?.toLowerCase() || "";

      const searchMatched = !q || supplierName.includes(q) || invoiceNumber.includes(q);
      const statusMatched = !statusFilter || invoice.paymentStatus === statusFilter;

      return searchMatched && statusMatched;
    });
  }, [purchases, search, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPurchases.length / PAGE_SIZE));

  const paginatedPurchases = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredPurchases.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredPurchases, page]);

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

  const purchaseTotals = useMemo(() => {
    const normalizedItems = form.items.map((item) => {
      const quantity = Math.max(0, Number(item.quantity || 0));
      const fallbackPrice = Number(productById[item.productId]?.purchasePrice || 0);
      const unitPrice = item.unitPrice === "" ? fallbackPrice : Math.max(0, Number(item.unitPrice || 0));
      const subtotal = Number((quantity * unitPrice).toFixed(2));

      return {
        ...item,
        quantity,
        unitPrice,
        subtotal,
      };
    });

    const totalAmount = Number(
      normalizedItems.reduce((sum, item) => sum + item.subtotal, 0).toFixed(2)
    );

    let paidAmount = 0;
    if (form.paymentStatus === "paid") {
      paidAmount = totalAmount;
    } else if (form.paymentStatus === "partial") {
      paidAmount = Number(Math.min(totalAmount, Math.max(0, Number(form.paidAmount || 0))).toFixed(2));
    }

    const dueAmount = Number((totalAmount - paidAmount).toFixed(2));

    return {
      normalizedItems,
      totalAmount,
      paidAmount,
      dueAmount,
    };
  }, [form, productById]);

  const hasPurchaseDraftChanges = useMemo(() => {
    const baseline = buildEmptyForm();
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form]);

  const openBuilder = () => {
    setForm(buildEmptyForm());
    setSupplierOptionsOpen(false);
    setProductOptionsOpenIndex(null);
    setBuilderOpen(true);
    setNotice("");
    setError("");
  };

  const closeBuilder = async (force = false) => {
    if (saving) {
      return;
    }

    if (!force && hasPurchaseDraftChanges) {
      const confirmed = await popup.confirm({
        title: "Discard Purchase Draft",
        message: "You have unsaved purchase changes. Discard this invoice draft?",
        confirmText: "Discard",
      });

      if (!confirmed) {
        return;
      }
    }

    setBuilderOpen(false);
    setForm(buildEmptyForm());
    setSupplierOptionsOpen(false);
    setProductOptionsOpenIndex(null);
  };

  const openView = (invoice) => {
    setSelectedPurchase(invoice);
    setViewOpen(true);
  };

  const closeView = () => {
    setSelectedPurchase(null);
    setViewOpen(false);
  };

  const onFieldChange = (key, value) => {
    setForm((prev) => {
      if (key === "supplierQuery") {
        const query = String(value || "").trim().toLowerCase();
        const selected = suppliers.find((supplier) => supplier.name?.trim().toLowerCase() === query);

        return {
          ...prev,
          supplierQuery: value,
          supplierId: selected?._id || "",
        };
      }

      return { ...prev, [key]: value };
    });
  };

  const filteredSuppliersForSearch = useMemo(() => {
    const query = (form.supplierQuery || "").trim().toLowerCase();

    if (!query) {
      return [];
    }

    return suppliers
      .filter((supplier) => {
        const name = (supplier.name || "").toLowerCase();
        const phone = (supplier.phone || "").toLowerCase();
        return name.includes(query) || phone.includes(query);
      })
      .slice(0, 8);
  }, [suppliers, form.supplierQuery]);

  const selectSupplier = (supplier) => {
    setForm((prev) => ({
      ...prev,
      supplierId: supplier._id,
      supplierQuery: supplier.name || "",
    }));
    setSupplierOptionsOpen(false);
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
          unitPrice: String(product.purchasePrice || ""),
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
          next.unitPrice = selected ? String(selected.purchasePrice || "") : "";
        }

        if (key === "productQuery") {
          const query = String(value || "").trim().toLowerCase();
          const selected = products.find((product) => product.name?.trim().toLowerCase() === query);

          next.productId = selected?._id || "";
          if (selected) {
            next.unitPrice = String(selected.purchasePrice || "");
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

  const submitPurchase = async (event) => {
    event.preventDefault();

    if (form.date < minBillingDate) {
      setError("Invoice date cannot be in the past");
      return;
    }

    if (!form.supplierId) {
      setError("Supplier is required. Please search and select a supplier from the list");
      return;
    }

    const hasInvalidLine = purchaseTotals.normalizedItems.some(
      (item) => !item.productId || item.quantity <= 0
    );

    if (hasInvalidLine) {
      setError("Each line must have a product and quantity greater than zero");
      return;
    }

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload = {
        supplierId: form.supplierId,
        date: new Date(form.date),
        items: purchaseTotals.normalizedItems.map((item) => ({
          productId: item.productId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
        })),
        paymentStatus: form.paymentStatus,
        paidAmount: purchaseTotals.paidAmount,
      };

      await client.post("/purchases", payload);
      setNotice("Purchase invoice created successfully");
      await closeBuilder(true);
      await loadBase();
      setPage(1);
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Failed to create purchase invoice");
    } finally {
      setSaving(false);
    }
  };

  const printPurchase = (invoice) => {
    if (!invoice?._id) {
      return;
    }

    navigate(`/purchases/${invoice._id}/print`);
  };

  const settlePurchasePayment = async () => {
    if (!selectedPurchase || settlingPayment) {
      return;
    }

    const dueAmount = Number(
      Math.max(0, Number(selectedPurchase.totalAmount || 0) - Number(selectedPurchase.paidAmount || 0)).toFixed(2)
    );

    if (dueAmount <= 0) {
      setNotice("Purchase invoice is already fully paid");
      return;
    }

    const value = await popup.prompt({
      title: "Pay Supplier",
      message: `Enter payment amount (max ${dueAmount}):`,
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
      message: "Select payment method for this supplier payment:",
      inputType: "select",
      inputOptions: paymentMethodOptions,
      initialValue: "cash",
      required: true,
      confirmText: "Continue",
    });

    if (method === null) {
      return;
    }

    try {
      setSettlingPayment(true);
      setError("");

      const response = await client.patch(`/purchases/${selectedPurchase._id}/payment`, {
        amount,
        paymentMethod: method,
      });

      const updated = response.data?.data;
      if (updated) {
        setSelectedPurchase(updated);
      }

      await loadBase();
      const remaining = Math.max(0, dueAmount - amount);
      setNotice(
        remaining > 0
          ? `Payment recorded. Remaining payable: ${currency.format(remaining)}`
          : "Purchase payable cleared successfully"
      );
    } catch (paymentError) {
      setError(paymentError.response?.data?.message || "Failed to record supplier payment");
    } finally {
      setSettlingPayment(false);
    }
  };

  const showingFrom = filteredPurchases.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredPurchases.length);

  return (
    <Layout title="Purchases">
      <div className="sales-wrap">
        <section className="sales-hero">
          <div>
            <p className="hero-eyebrow">Stock Inward Desk</p>
            <h2>Track buying activity, payables, and inventory inflow in one place</h2>
          </div>
          <button type="button" className="primary-btn" onClick={openBuilder}>
            New Purchase
          </button>
        </section>

        <div className="sales-kpis">
          <article className="product-stat-card">
            <p>Purchases Today</p>
            <h3>{stats.todayInvoices}</h3>
          </article>
          <article className="product-stat-card">
            <p>Today Purchase Cost</p>
            <h3>{currency.format(stats.todayPurchaseCost)}</h3>
          </article>
          <article className="product-stat-card">
            <p>Today Paid</p>
            <h3>{currency.format(stats.todayPaid)}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>Outstanding Payables</p>
            <h3>{currency.format(stats.outstandingPayables)}</h3>
          </article>
        </div>

        <section className="sales-filters">
          <input
            type="search"
            placeholder="Search by purchase invoice or supplier"
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
            <p>Loading purchases...</p>
          ) : (
            <div className="products-table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Invoice</th>
                    <th>Date</th>
                    <th>Supplier</th>
                    <th>Items</th>
                    <th>Total</th>
                    <th>Paid</th>
                    <th>Due</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.length === 0 ? (
                    <tr>
                      <td colSpan="9">No purchases found.</td>
                    </tr>
                  ) : (
                    paginatedPurchases.map((invoice) => {
                      const due = Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0);
                      return (
                        <tr key={invoice._id}>
                          <td>{invoice.purchaseInvoiceNumber}</td>
                          <td>{dateShort.format(new Date(invoice.date))}</td>
                          <td>{invoice.supplierId?.name || "-"}</td>
                          <td>{invoice.items?.length || 0}</td>
                          <td>{currency.format(Number(invoice.totalAmount || 0))}</td>
                          <td>{currency.format(Number(invoice.paidAmount || 0))}</td>
                          <td>{currency.format(Math.max(0, due))}</td>
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

          {!loading && filteredPurchases.length > PAGE_SIZE ? (
            <div className="table-pagination">
              <p>
                Showing {showingFrom}-{showingTo} of {filteredPurchases.length}
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
            <button className="editor-backdrop" type="button" onClick={() => closeBuilder()} aria-label="Close" />
            <section className="editor-card modal sales-modal-card">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Purchase Builder</p>
                  <h3>Create Purchase Invoice</h3>
                  <p className="editor-subtitle">
                    Add supplier bill lines and post stock inflow directly to inventory.
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={() => closeBuilder()}>
                  Close
                </button>
              </div>

              <form className="editor-form sales-form" onSubmit={submitPurchase}>
                {error ? <p key={errorKey} className="error-text sales-modal-error">{error}</p> : null}

                <label>
                  Supplier
                  <div className="sales-search-field">
                    <input
                      required
                      placeholder="Search supplier name or phone"
                      value={form.supplierQuery || ""}
                      onFocus={() => setSupplierOptionsOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setSupplierOptionsOpen(false);
                        }, 120);
                      }}
                      onChange={(event) => {
                        onFieldChange("supplierQuery", event.target.value);
                        setSupplierOptionsOpen(true);
                      }}
                    />

                    {supplierOptionsOpen && (form.supplierQuery || "").trim() ? (
                      <div className="sales-search-dropdown" role="listbox" aria-label="Suppliers">
                        {filteredSuppliersForSearch.length === 0 ? (
                          <p className="sales-search-empty">No suppliers found</p>
                        ) : (
                          filteredSuppliersForSearch.map((supplier) => (
                            <button
                              key={supplier._id}
                              type="button"
                              className="sales-search-option"
                              onMouseDown={() => selectSupplier(supplier)}
                            >
                              <span>{supplier.name}</span>
                              {supplier.phone ? <small>{supplier.phone}</small> : null}
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
                    value={form.date}
                    onChange={(event) => onFieldChange("date", event.target.value)}
                  />
                </label>

                <section className="sales-lines">
                  <div className="sales-lines-head">
                    <h4>Purchase Items</h4>
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
                        ? String(purchaseTotals.totalAmount)
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
                    <span>Total Amount</span>
                    <strong>{currency.format(purchaseTotals.totalAmount)}</strong>
                  </p>
                  <p>
                    <span>Paid</span>
                    <strong>{currency.format(purchaseTotals.paidAmount)}</strong>
                  </p>
                  <p>
                    <span>Due</span>
                    <strong>{currency.format(purchaseTotals.dueAmount)}</strong>
                  </p>
                </section>

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={() => closeBuilder()}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? "Saving..." : "Create Purchase"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {viewOpen && selectedPurchase ? (
          <div className="editor-modal" role="dialog" aria-modal="true">
            <button className="editor-backdrop" type="button" onClick={closeView} aria-label="Close" />
            <section className="editor-card modal sales-view-card">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Purchase Preview</p>
                  <h3>{selectedPurchase.purchaseInvoiceNumber}</h3>
                  <p className="editor-subtitle">
                    {dateTime.format(new Date(selectedPurchase.date))} • {selectedPurchase.supplierId?.name || "Supplier"}
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={closeView}>
                  Close
                </button>
              </div>

              <div className="invoice-view-body">
                <div className="invoice-kpi-grid">
                  <article className="detail-mini-card">
                    <p>Total Amount</p>
                    <h4>{currency.format(Number(selectedPurchase.totalAmount || 0))}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Paid</p>
                    <h4>{currency.format(Number(selectedPurchase.paidAmount || 0))}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Due</p>
                    <h4>
                      {currency.format(
                        Math.max(
                          0,
                          Number(selectedPurchase.totalAmount || 0) - Number(selectedPurchase.paidAmount || 0)
                        )
                      )}
                    </h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Status</p>
                    <h4>{(selectedPurchase.paymentStatus || "unpaid").toUpperCase()}</h4>
                  </article>
                </div>

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
                      {(selectedPurchase.items || []).map((item, index) => (
                        <tr key={`${selectedPurchase._id}-item-${index}`}>
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
                    Number(selectedPurchase.totalAmount || 0) - Number(selectedPurchase.paidAmount || 0)
                  ) > 0 ? (
                    <button
                      type="button"
                      className="ghost-btn"
                      onClick={settlePurchasePayment}
                      disabled={settlingPayment}
                    >
                      {settlingPayment ? "Recording..." : "Pay Due"}
                    </button>
                  ) : null}
                  <button type="button" className="primary-btn" onClick={() => printPurchase(selectedPurchase)}>
                    Print Purchase
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

export default PurchasesPage;
