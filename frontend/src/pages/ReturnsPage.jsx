import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { useSmartPopup } from "../components/SmartPopupProvider";
import client from "../api/client";
import useToastMessage from "../hooks/useToastMessage";

const PAGE_SIZE = 10;

const currency = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

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

const resolveReceiverLabel = (entry, storeName) => {
  const role = String(entry?.receivedById?.role || "").toLowerCase();

  if (role === "admin") {
    return storeName || "HafizG Mobile";
  }

  return (
    entry?.receivedById?.name ||
    entry?.receivedById?.username ||
    entry?.receivedByName ||
    "Unknown User"
  );
};

const buildEmptyForm = () => ({
  saleInvoiceId: "",
  saleInvoiceQuery: "",
  date: new Date().toISOString().slice(0, 10),
  refundMethod: "adjustment",
  notes: "",
  items: [],
});

const ReturnsPage = () => {
  const popup = useSmartPopup();
  const storeName = useMemo(() => getStoreNameFromSettings(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [returnsData, setReturnsData] = useState([]);
  const [sales, setSales] = useState([]);
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();

  const [search, setSearch] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [page, setPage] = useState(1);

  const [builderOpen, setBuilderOpen] = useState(false);
  const [form, setForm] = useState(buildEmptyForm());
  const [invoiceOptionsOpen, setInvoiceOptionsOpen] = useState(false);
  const [modalError, setModalError] = useState("");
  const hasReturnDraftChanges = useMemo(() => {
    const baseline = buildEmptyForm();
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form]);

  const loadBase = async () => {
    try {
      setLoading(true);
      setError("");

      const [returnsRes, salesRes] = await Promise.all([client.get("/returns"), client.get("/sales")]);
      setReturnsData(returnsRes.data?.data || []);
      setSales(salesRes.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load returns page");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    if (!builderOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        closeBuilder();
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [builderOpen, form, saving]);

  const returnedQtyBySaleProduct = useMemo(() => {
    const map = {};

    returnsData.forEach((entry) => {
      const saleId = entry.saleInvoiceId?._id || entry.saleInvoiceId;
      (entry.items || []).forEach((line) => {
        const productId = line.productId?._id || line.productId;
        const key = `${saleId}-${productId}`;
        map[key] = (map[key] || 0) + Number(line.quantity || 0);
      });
    });

    return map;
  }, [returnsData]);

  const filteredInvoiceOptions = useMemo(() => {
    const query = (form.saleInvoiceQuery || "").trim().toLowerCase();

    if (!query) {
      return [];
    }

    return sales
      .filter((invoice) => {
        const invoiceNumber = (invoice.invoiceNumber || "").toLowerCase();
        const customerName = (invoice.customerId?.name || "walk-in customer").toLowerCase();
        return invoiceNumber.includes(query) || customerName.includes(query);
      })
      .slice(0, 8);
  }, [sales, form.saleInvoiceQuery]);

  const selectInvoice = (invoice) => {
    const saleId = invoice._id;

    const lines = (invoice.items || []).map((line, index) => {
      const productId = line.productId?._id || line.productId;
      const soldQty = Number(line.quantity || 0);
      const alreadyReturned = Number(returnedQtyBySaleProduct[`${saleId}-${productId}`] || 0);
      const maxReturnQty = Math.max(0, soldQty - alreadyReturned);

      return {
        key: `${productId}-${index}`,
        productId,
        productName: line.productId?.name || "-",
        soldQty,
        alreadyReturned,
        maxReturnQty,
        returnQty: "0",
        reason: "",
      };
    });

    setForm((prev) => ({
      ...prev,
      saleInvoiceId: saleId,
      saleInvoiceQuery: `${invoice.invoiceNumber} - ${invoice.customerId?.name || "Walk-in Customer"}`,
      items: lines,
    }));

    setInvoiceOptionsOpen(false);
  };

  const openBuilder = () => {
    setForm(buildEmptyForm());
    setBuilderOpen(true);
    setModalError("");
    setError("");
    setNotice("");
  };

  const closeBuilder = async (force = false) => {
    if (saving) {
      return;
    }

    if (!force && hasReturnDraftChanges) {
      const confirmed = await popup.confirm({
        title: "Discard Return Draft",
        message: "You have unsaved return changes. Discard this draft?",
        confirmText: "Discard",
      });

      if (!confirmed) {
        return;
      }
    }

    setBuilderOpen(false);
    setForm(buildEmptyForm());
    setInvoiceOptionsOpen(false);
    setModalError("");
  };

  const onLineChange = (index, key, value) => {
    setForm((prev) => ({
      ...prev,
      items: prev.items.map((line, lineIndex) =>
        lineIndex === index
          ? {
              ...line,
              [key]: value,
            }
          : line
      ),
    }));
  };

  const submitReturn = async (event) => {
    event.preventDefault();

    if (!form.saleInvoiceId) {
      setModalError("Please search and select a sale invoice");
      return;
    }

    const selectedLines = form.items
      .map((line) => ({
        ...line,
        qty: Number(line.returnQty || 0),
      }))
      .filter((line) => line.qty > 0);

    if (selectedLines.length === 0) {
      setModalError("Enter return quantity for at least one product line");
      return;
    }

    const invalidLine = selectedLines.find((line) => line.qty > line.maxReturnQty);
    if (invalidLine) {
      setModalError(`Return quantity exceeds allowed value for ${invalidLine.productName}`);
      return;
    }

    try {
      setSaving(true);
      setModalError("");
      setError("");
      setNotice("");

      const payload = {
        saleInvoiceId: form.saleInvoiceId,
        date: form.date,
        refundMethod: form.refundMethod,
        notes: form.notes.trim(),
        items: selectedLines.map((line) => ({
          productId: line.productId,
          quantity: line.qty,
          reason: line.reason.trim(),
        })),
      };

      await client.post("/returns", payload);
      setNotice("Product return recorded successfully");
      await closeBuilder(true);
      await loadBase();
      setPage(1);
    } catch (saveError) {
      setModalError(saveError.response?.data?.message || "Failed to record product return");
    } finally {
      setSaving(false);
    }
  };

  const filteredReturns = useMemo(() => {
    const query = search.trim().toLowerCase();

    return returnsData.filter((row) => {
      const returnDate = new Date(row.date).toISOString().slice(0, 10);
      const invoiceNumber = row.saleInvoiceId?.invoiceNumber || "";
      const customerName = row.customerId?.name || "Walk-in Customer";

      const searchMatched =
        !query ||
        row.returnNumber?.toLowerCase().includes(query) ||
        invoiceNumber.toLowerCase().includes(query) ||
        customerName.toLowerCase().includes(query);

      const fromMatched = !fromDate || returnDate >= fromDate;
      const toMatched = !toDate || returnDate <= toDate;

      return searchMatched && fromMatched && toMatched;
    });
  }, [returnsData, search, fromDate, toDate]);

  const stats = useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);

    const todayEntries = filteredReturns.filter(
      (row) => new Date(row.date).toISOString().slice(0, 10) === today
    );

    return {
      totalReturns: filteredReturns.length,
      todayReturns: todayEntries.length,
      returnedAmount: filteredReturns.reduce((sum, row) => sum + Number(row.totalAmount || 0), 0),
      returnedQty: filteredReturns.reduce(
        (sum, row) =>
          sum + (row.items || []).reduce((itemSum, item) => itemSum + Number(item.quantity || 0), 0),
        0
      ),
    };
  }, [filteredReturns]);

  const totalPages = Math.max(1, Math.ceil(filteredReturns.length / PAGE_SIZE));
  const paginatedReturns = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredReturns.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredReturns, page]);

  const showingFrom = filteredReturns.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredReturns.length);

  return (
    <Layout title="Product Returns">
      <div className="sales-wrap">
        <section className="sales-hero">
          <div>
            <p className="hero-eyebrow">Returns Desk</p>
            <h2>Record product returns, keep stock accurate, and maintain customer balance control</h2>
          </div>
          <button type="button" className="primary-btn" onClick={openBuilder}>
            New Return
          </button>
        </section>

        <div className="sales-kpis">
          <article className="product-stat-card">
            <p>Total Returns</p>
            <h3>{stats.totalReturns}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>Returns Today</p>
            <h3>{stats.todayReturns}</h3>
          </article>
          <article className="product-stat-card">
            <p>Returned Amount</p>
            <h3>{currency.format(stats.returnedAmount)}</h3>
          </article>
          <article className="product-stat-card">
            <p>Returned Units</p>
            <h3>{stats.returnedQty}</h3>
          </article>
        </div>

        <section className="returns-filters">
          <input
            type="search"
            placeholder="Search by return number, invoice, or customer"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} />
          <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} />
        </section>

        {notice ? <p key={noticeKey} className="success-text">{notice}</p> : null}
        {!builderOpen && error ? <p key={errorKey} className="error-text">{error}</p> : null}

        <section className="products-table-card">
          {loading ? (
            <p>Loading returns...</p>
          ) : (
            <div className="products-table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Return #</th>
                    <th>Date</th>
                    <th>Invoice</th>
                    <th>Customer</th>
                    <th>Received By</th>
                    <th>Items</th>
                    <th>Refund Method</th>
                    <th>Total Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.length === 0 ? (
                    <tr>
                      <td colSpan="8">No returns found.</td>
                    </tr>
                  ) : (
                    paginatedReturns.map((entry) => (
                      <tr key={entry._id}>
                        <td>{entry.returnNumber}</td>
                        <td>{dateShort.format(new Date(entry.date))}</td>
                        <td>{entry.saleInvoiceId?.invoiceNumber || "-"}</td>
                        <td>{entry.customerId?.name || "Walk-in Customer"}</td>
                        <td>{resolveReceiverLabel(entry, storeName)}</td>
                        <td>{entry.items?.length || 0}</td>
                        <td>{(entry.refundMethod || "adjustment").toUpperCase()}</td>
                        <td>{currency.format(Number(entry.totalAmount || 0))}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredReturns.length > PAGE_SIZE ? (
            <div className="table-pagination">
              <p>
                Showing {showingFrom}-{showingTo} of {filteredReturns.length}
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
                  <p className="hero-eyebrow">Return Builder</p>
                  <h3>Create Product Return</h3>
                  <p className="editor-subtitle">
                    Select an invoice, define return quantities, and post automatic stock adjustments.
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={() => closeBuilder()}>
                  Close
                </button>
              </div>

              <form className="editor-form sales-form" onSubmit={submitReturn}>
                {modalError ? <p className="sales-modal-error">{modalError}</p> : null}

                <label>
                  Sale Invoice
                  <div className="sales-search-field">
                    <input
                      required
                      placeholder="Search invoice number or customer"
                      value={form.saleInvoiceQuery}
                      onFocus={() => setInvoiceOptionsOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => setInvoiceOptionsOpen(false), 120);
                      }}
                      onChange={(event) =>
                        setForm((prev) => ({
                          ...prev,
                          saleInvoiceQuery: event.target.value,
                          saleInvoiceId: "",
                          items: [],
                        }))
                      }
                    />

                    {invoiceOptionsOpen && (form.saleInvoiceQuery || "").trim() ? (
                      <div className="sales-search-dropdown" role="listbox" aria-label="Sale invoices">
                        {filteredInvoiceOptions.length === 0 ? (
                          <p className="sales-search-empty">No invoice found</p>
                        ) : (
                          filteredInvoiceOptions.map((invoice) => (
                            <button
                              key={invoice._id}
                              type="button"
                              className="sales-search-option"
                              onMouseDown={() => selectInvoice(invoice)}
                            >
                              <span>{invoice.invoiceNumber}</span>
                              <small>{invoice.customerId?.name || "Walk-in Customer"}</small>
                            </button>
                          ))
                        )}
                      </div>
                    ) : null}
                  </div>
                </label>

                <label>
                  Return Date
                  <input
                    required
                    type="date"
                    value={form.date}
                    onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                  />
                </label>

                <section className="sales-lines">
                  <div className="sales-lines-head">
                    <h4>Return Items</h4>
                  </div>

                  {form.items.length === 0 ? (
                    <p className="invoice-meta-row">Select an invoice first to load returnable products.</p>
                  ) : (
                    <div className="sales-lines-grid returns-lines-grid">
                      {form.items.map((line, index) => (
                        <div key={line.key} className="returns-line-row">
                          <p className="returns-product-name">{line.productName}</p>
                          <p>Sold: {line.soldQty}</p>
                          <p>Already Returned: {line.alreadyReturned}</p>
                          <p>Max: {line.maxReturnQty}</p>

                          <label>
                            Return Qty
                            <input
                              type="number"
                              min="0"
                              max={line.maxReturnQty}
                              step="1"
                              value={line.returnQty}
                              onChange={(event) => onLineChange(index, "returnQty", event.target.value)}
                            />
                          </label>

                          <label>
                            Reason (Optional)
                            <input
                              value={line.reason}
                              onChange={(event) => onLineChange(index, "reason", event.target.value)}
                              placeholder="e.g., Defect / Wrong item"
                            />
                          </label>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                <label>
                  Refund Method
                  <select
                    value={form.refundMethod}
                    onChange={(event) => setForm((prev) => ({ ...prev, refundMethod: event.target.value }))}
                  >
                    <option value="adjustment">Adjustment</option>
                    <option value="cash">Cash</option>
                    <option value="bank">Bank</option>
                    <option value="card">Card</option>
                    <option value="upi">UPI</option>
                    <option value="other">Other</option>
                  </select>
                </label>

                <label>
                  Notes
                  <input
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                    placeholder="Optional return note"
                  />
                </label>

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={() => closeBuilder()}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? "Saving..." : "Save Return"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}
      </div>
    </Layout>
  );
};

export default ReturnsPage;
