import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import client from "../api/client";
import { useSmartPopup } from "../components/SmartPopupProvider";
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

const resolveReceiverLabel = (claim, storeName) => {
  const role = String(claim?.receivedById?.role || "").toLowerCase();

  if (role === "admin") {
    return storeName || "HafizG Mobile";
  }

  return (
    claim?.receivedById?.name ||
    claim?.receivedById?.username ||
    claim?.receivedByName ||
    "Unknown User"
  );
};

const getSuggestedRefundAmount = (line, quantityValue) => {
  const quantity = Number(quantityValue || 0);
  const unitPrice = Number(line?.unitPrice || 0);

  if (!Number.isFinite(quantity) || quantity <= 0 || !Number.isFinite(unitPrice) || unitPrice <= 0) {
    return "";
  }

  return (quantity * unitPrice).toFixed(2);
};

const buildEmptyForm = () => ({
  invoiceId: "",
  invoiceQuery: "",
  productId: "",
  productQuery: "",
  quantity: "1",
  reason: "",
  replacementGiven: true,
  refundGiven: false,
  refundAmount: "",
  notes: "",
});

const ClaimsPage = () => {
  const popup = useSmartPopup();
  const storeName = useMemo(() => getStoreNameFromSettings(), []);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [processingId, setProcessingId] = useState("");
  const [claims, setClaims] = useState([]);
  const [sales, setSales] = useState([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [page, setPage] = useState(1);
  const [builderOpen, setBuilderOpen] = useState(false);
  const [invoiceOptionsOpen, setInvoiceOptionsOpen] = useState(false);
  const [productOptionsOpen, setProductOptionsOpen] = useState(false);
  const [form, setForm] = useState(buildEmptyForm());
  const hasClaimDraftChanges = useMemo(() => {
    const baseline = buildEmptyForm();
    return JSON.stringify(form) !== JSON.stringify(baseline);
  }, [form]);
  const [modalError, setModalError] = useState("");
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();

  const loadBase = async () => {
    try {
      setLoading(true);
      setError("");

      const [claimsRes, salesRes] = await Promise.all([client.get("/claims"), client.get("/sales")]);
      setClaims(claimsRes.data?.data || []);
      setSales(salesRes.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load claims page");
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

  useEffect(() => {
    setPage(1);
  }, [search, statusFilter]);

  const claimedQtyByInvoiceProduct = useMemo(() => {
    const map = {};

    claims.forEach((claim) => {
      const invoiceId = claim.invoiceId?._id || claim.invoiceId;
      const productId = claim.productId?._id || claim.productId;
      if (!invoiceId || !productId) {
        return;
      }
      const key = `${invoiceId}-${productId}`;
      map[key] = (map[key] || 0) + Number(claim.quantity || 0);
    });

    return map;
  }, [claims]);

  const selectedSale = useMemo(
    () => sales.find((invoice) => String(invoice._id) === String(form.invoiceId)),
    [sales, form.invoiceId]
  );

  const selectedSaleProducts = useMemo(() => {
    if (!selectedSale) {
      return [];
    }

    return (selectedSale.items || [])
      .map((line) => {
        const productId = line.productId?._id || line.productId;
        const soldQty = Number(line.quantity || 0);
        const alreadyClaimed = Number(claimedQtyByInvoiceProduct[`${selectedSale._id}-${productId}`] || 0);
        const claimableQty = Math.max(0, soldQty - alreadyClaimed);

        return {
          productId,
          productName: line.productId?.name || "-",
          unitPrice: Number(line.unitPrice || 0),
          soldQty,
          alreadyClaimed,
          claimableQty,
        };
      })
      .filter((line) => line.claimableQty > 0);
  }, [selectedSale, claimedQtyByInvoiceProduct]);

  const selectedLine = useMemo(
    () => selectedSaleProducts.find((line) => String(line.productId) === String(form.productId)),
    [selectedSaleProducts, form.productId]
  );

  const filteredProductOptions = useMemo(() => {
    const query = (form.productQuery || "").trim().toLowerCase();

    if (!query) {
      return selectedSaleProducts.slice(0, 8);
    }

    return selectedSaleProducts
      .filter((line) => (line.productName || "").toLowerCase().includes(query))
      .slice(0, 8);
  }, [selectedSaleProducts, form.productQuery]);

  const filteredInvoiceOptions = useMemo(() => {
    const query = (form.invoiceQuery || "").trim().toLowerCase();

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
  }, [sales, form.invoiceQuery]);

  const filteredClaims = useMemo(() => {
    const query = search.trim().toLowerCase();

    return claims.filter((row) => {
      const searchMatched =
        !query ||
        row.claimNumber?.toLowerCase().includes(query) ||
        row.invoiceId?.invoiceNumber?.toLowerCase().includes(query) ||
        row.customerId?.name?.toLowerCase().includes(query) ||
        row.productId?.name?.toLowerCase().includes(query) ||
        row.supplierId?.name?.toLowerCase().includes(query);

      const statusMatched = !statusFilter || row.status === statusFilter;
      return searchMatched && statusMatched;
    });
  }, [claims, search, statusFilter]);

  const stats = useMemo(() => {
    const pendingCount = claims.filter((row) => row.status === "pending").length;
    const acceptedCount = claims.filter((row) => row.status === "accepted").length;
    const rejectedCount = claims.filter(
      (row) => row.status === "rejected" || (row.status === "closed" && row.supplierStatus === "rejected")
    ).length;

    const claimLossExposure = claims
      .filter(
        (row) =>
          ["pending", "sent_to_supplier", "rejected"].includes(row.status) ||
          (row.status === "closed" && row.supplierStatus === "rejected")
      )
      .reduce(
        (sum, row) =>
          sum +
          (Number(row.lossAmount || 0) || Number(row.quantity || 0) * Number(row.purchasePrice || 0)),
        0
      );

    return {
      pendingCount,
      acceptedCount,
      rejectedCount,
      claimLossExposure,
    };
  }, [claims]);

  const totalPages = Math.max(1, Math.ceil(filteredClaims.length / PAGE_SIZE));

  const paginatedClaims = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredClaims.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredClaims, page]);

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

  const openBuilder = () => {
    setBuilderOpen(true);
    setForm(buildEmptyForm());
    setModalError("");
    setNotice("");
    setError("");
  };

  const closeBuilder = async (force = false) => {
    if (saving) {
      return;
    }

    if (!force && hasClaimDraftChanges) {
      const confirmed = await popup.confirm({
        title: "Discard Claim Draft",
        message: "You have unsaved claim changes. Discard this draft?",
        confirmText: "Discard",
      });

      if (!confirmed) {
        return;
      }
    }

    setBuilderOpen(false);
    setForm(buildEmptyForm());
    setInvoiceOptionsOpen(false);
    setProductOptionsOpen(false);
    setModalError("");
    setError("");
  };

  const selectInvoice = (invoice) => {
    setForm((prev) => ({
      ...prev,
      invoiceId: invoice._id,
      invoiceQuery: `${invoice.invoiceNumber} - ${invoice.customerId?.name || "Walk-in Customer"}`,
      productId: "",
      productQuery: "",
      quantity: "1",
      refundAmount: "",
    }));
    setInvoiceOptionsOpen(false);
    setProductOptionsOpen(false);
  };

  const selectProduct = (line) => {
    setForm((prev) => ({
      ...prev,
      productId: line.productId,
      productQuery: line.productName,
      quantity: "1",
      refundAmount: prev.refundGiven ? getSuggestedRefundAmount(line, "1") : prev.refundAmount,
    }));
    setProductOptionsOpen(false);
  };

  const submitClaim = async (event) => {
    event.preventDefault();

    if (!form.invoiceId) {
      setModalError("Please select an invoice");
      return;
    }

    if (!form.productId) {
      setModalError("Please select a product from selected invoice");
      return;
    }

    const qty = Number(form.quantity || 0);
    if (!Number.isFinite(qty) || qty <= 0) {
      setModalError("Enter a valid quantity");
      return;
    }

    if (selectedLine && qty > selectedLine.claimableQty) {
      setModalError(`Claim quantity exceeds allowed value. Max: ${selectedLine.claimableQty}`);
      return;
    }

    if (form.refundGiven && Number(form.refundAmount || 0) <= 0) {
      setModalError("Refund amount must be greater than zero");
      return;
    }

    try {
      setSaving(true);
      setModalError("");
      setNotice("");

      const payload = {
        invoiceId: form.invoiceId,
        productId: form.productId,
        quantity: qty,
        reason: form.reason.trim(),
        replacementGiven: form.replacementGiven,
        refundGiven: form.refundGiven,
        refundAmount: form.refundGiven ? Number(form.refundAmount || 0) : 0,
        notes: form.notes.trim(),
      };

      await client.post("/claims", payload);
      setNotice("Claim created successfully");
      await closeBuilder(true);
      await loadBase();
      setPage(1);
    } catch (saveError) {
      setModalError(saveError.response?.data?.message || "Failed to create claim");
    } finally {
      setSaving(false);
    }
  };

  const runStatusAction = async (claim, action) => {
    if (!claim?._id || processingId) {
      return;
    }

    let endpoint = "";
    let title = "";
    let message = "";
    let confirmText = "";
    let body = {};

    if (action === "send") {
      endpoint = `/claims/${claim._id}/send-to-supplier`;
      title = "Send Claim";
      message = "Mark this claim as sent to supplier?";
      confirmText = "Send";
    }

    if (action === "accept") {
      endpoint = `/claims/${claim._id}/accept`;
      title = "Accept Claim";
      message = "Mark this claim as accepted by supplier?";
      confirmText = "Accept";
    }

    if (action === "reject") {
      const notes = await popup.prompt({
        title: "Reject Claim",
        message: "Enter rejection note (optional):",
        inputType: "text",
        initialValue: "",
        confirmText: "Continue",
      });

      if (notes === null) {
        return;
      }

      endpoint = `/claims/${claim._id}/reject`;
      title = "Reject Claim";
      message = "Confirm rejection of this claim?";
      confirmText = "Reject";
      body = { notes: notes || "" };
    }

    const confirmed = await popup.confirm({
      title,
      message,
      confirmText,
    });

    if (!confirmed) {
      return;
    }

    try {
      setProcessingId(claim._id);
      setError("");
      setNotice("");
      await client.patch(endpoint, body);
      setNotice("Claim status updated");
      await loadBase();
    } catch (actionError) {
      setError(actionError.response?.data?.message || "Failed to update claim");
    } finally {
      setProcessingId("");
    }
  };

  const showingFrom = filteredClaims.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredClaims.length);

  return (
    <Layout title="Claims">
      <div className="sales-wrap">
        <section className="sales-hero">
          <div>
            <p className="hero-eyebrow">Claims Desk</p>
            <h2>Track supplier approval claims with replacement/refund and loss visibility</h2>
          </div>
          <button type="button" className="primary-btn" onClick={openBuilder}>
            New Claim
          </button>
        </section>

        <div className="sales-kpis">
          <article className="product-stat-card warning">
            <p>Pending Claims</p>
            <h3>{stats.pendingCount}</h3>
          </article>
          <article className="product-stat-card">
            <p>Supplier Accepted</p>
            <h3>{stats.acceptedCount}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>Supplier Rejected</p>
            <h3>{stats.rejectedCount}</h3>
          </article>
          <article className="product-stat-card">
            <p>Claim Loss Exposure</p>
            <h3>{currency.format(stats.claimLossExposure)}</h3>
          </article>
        </div>

        <section className="sales-filters">
          <input
            type="search"
            placeholder="Search by claim number, invoice, customer, product, supplier"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="">All Status</option>
            <option value="pending">Pending</option>
            <option value="sent_to_supplier">Sent To Supplier</option>
            <option value="accepted">Accepted</option>
            <option value="rejected">Rejected</option>
          </select>
        </section>

        {notice ? <p key={noticeKey} className="success-text">{notice}</p> : null}
        {!builderOpen && error ? <p key={errorKey} className="error-text">{error}</p> : null}

        <section className="products-table-card">
          {loading ? (
            <p>Loading claims...</p>
          ) : (
            <div className="products-table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Claim ID</th>
                    <th>Product</th>
                    <th>Customer</th>
                    <th>Received By</th>
                    <th>Quantity</th>
                    <th>Replacement Given</th>
                    <th>Supplier Status</th>
                    <th>Loss Impact</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredClaims.length === 0 ? (
                    <tr>
                      <td colSpan="10">No claims found.</td>
                    </tr>
                  ) : (
                    paginatedClaims.map((claim) => {
                      const isRejectedClosed = claim.status === "closed" && claim.supplierStatus === "rejected";
                      const exposureStatuses = new Set(["pending", "sent_to_supplier", "rejected"]);
                      const rowLoss = exposureStatuses.has(claim.status) || isRejectedClosed
                        ? Number(claim.lossAmount || 0) || Number(claim.quantity || 0) * Number(claim.purchasePrice || 0)
                        : Number(claim.lossAmount || 0);

                      return (
                        <tr key={claim._id}>
                          <td>{claim.claimNumber}</td>
                          <td>{claim.productId?.name || "-"}</td>
                          <td>{claim.customerId?.name || "Walk-in Customer"}</td>
                          <td>{resolveReceiverLabel(claim, storeName)}</td>
                          <td>{claim.quantity}</td>
                          <td>{claim.replacementGiven ? "Yes" : "No"}</td>
                          <td>
                            <span className={`payment-pill ${claim.supplierStatus === "accepted" ? "paid" : claim.supplierStatus === "rejected" ? "unpaid" : "partial"}`}>
                              {claim.supplierStatus || "pending"}
                            </span>
                          </td>
                          <td>{currency.format(rowLoss)}</td>
                          <td>{dateShort.format(new Date(claim.createdAt))}</td>
                          <td className="table-actions">
                            {claim.status === "pending" ? (
                              <button
                                type="button"
                                disabled={processingId === claim._id}
                                onClick={() => runStatusAction(claim, "send")}
                              >
                                Send To Supplier
                              </button>
                            ) : null}
                            {claim.status === "sent_to_supplier" ? (
                              <>
                                <button
                                  type="button"
                                  disabled={processingId === claim._id}
                                  onClick={() => runStatusAction(claim, "accept")}
                                >
                                  Mark Accepted
                                </button>
                                <button
                                  type="button"
                                  disabled={processingId === claim._id}
                                  onClick={() => runStatusAction(claim, "reject")}
                                >
                                  Mark Rejected
                                </button>
                              </>
                            ) : null}
                            {(claim.status === "accepted" || claim.status === "rejected" || claim.status === "closed") ? (
                              <span className="payment-pill paid">Completed</span>
                            ) : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredClaims.length > PAGE_SIZE ? (
            <div className="table-pagination">
              <p>
                Showing {showingFrom}-{showingTo} of {filteredClaims.length}
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
            <section className="editor-card modal categories-modal-card">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Claim Builder</p>
                  <h3>Create Product Claim</h3>
                  <p className="editor-subtitle">
                    Record defective items, replacement/refund action, and start supplier approval workflow.
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={() => closeBuilder()}>
                  Close
                </button>
              </div>

              <form className="editor-form categories-form" onSubmit={submitClaim}>
                {modalError ? <p className="sales-modal-error">{modalError}</p> : null}

                <label>
                  Sale Invoice
                  <div className="sales-search-field">
                    <input
                      required
                      placeholder="Search invoice number or customer"
                      value={form.invoiceQuery}
                      onFocus={() => setInvoiceOptionsOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setInvoiceOptionsOpen(false);
                        }, 120);
                      }}
                      onChange={(event) => {
                        const value = event.target.value;
                        const query = String(value || "").trim().toLowerCase();
                        const matched = sales.find((invoice) => {
                          const invoiceLabel = `${invoice.invoiceNumber} - ${invoice.customerId?.name || "Walk-in Customer"}`;
                          return invoiceLabel.toLowerCase() === query;
                        });

                        setForm((prev) => ({
                          ...prev,
                          invoiceQuery: value,
                          invoiceId: matched?._id || "",
                          productId: matched ? prev.productId : "",
                          productQuery: matched ? prev.productQuery : "",
                          refundAmount: matched ? prev.refundAmount : "",
                        }));
                        setInvoiceOptionsOpen(true);
                      }}
                    />

                    {invoiceOptionsOpen && filteredInvoiceOptions.length > 0 ? (
                      <div className="sales-search-dropdown" role="listbox" aria-label="Invoices">
                        {filteredInvoiceOptions.map((invoice) => (
                          <button
                            key={invoice._id}
                            type="button"
                            className="sales-search-option"
                            onMouseDown={() => selectInvoice(invoice)}
                          >
                            <span>{invoice.invoiceNumber}</span>
                            <small>{invoice.customerId?.name || "Walk-in Customer"}</small>
                          </button>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </label>

                <label>
                  Product
                  <div className="sales-search-field">
                    <input
                      required
                      placeholder="Search product"
                      value={form.productQuery || ""}
                      onFocus={() => setProductOptionsOpen(true)}
                      onBlur={() => {
                        window.setTimeout(() => {
                          setProductOptionsOpen(false);
                        }, 120);
                      }}
                      onChange={(event) => {
                        const value = event.target.value;
                        const query = String(value || "").trim().toLowerCase();
                        const matched = selectedSaleProducts.find(
                          (line) => (line.productName || "").trim().toLowerCase() === query
                        );

                        setForm((prev) => ({
                          ...prev,
                          productQuery: value,
                          productId: matched?.productId || "",
                          quantity: matched ? "1" : prev.quantity,
                          refundAmount:
                            prev.refundGiven && matched
                              ? getSuggestedRefundAmount(matched, "1")
                              : prev.refundAmount,
                        }));
                        setProductOptionsOpen(true);
                      }}
                    />

                    {productOptionsOpen && form.invoiceId ? (
                      <div className="sales-search-dropdown" role="listbox" aria-label="Products">
                        {filteredProductOptions.length === 0 ? (
                          <p className="sales-search-empty">No claimable products found</p>
                        ) : (
                          filteredProductOptions.map((line) => (
                            <button
                              key={line.productId}
                              type="button"
                              className="sales-search-option"
                              onMouseDown={() => selectProduct(line)}
                            >
                              <span>{line.productName}</span>
                              <small>Claimable: {line.claimableQty}</small>
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
                    max={selectedLine ? String(selectedLine.claimableQty) : undefined}
                    value={form.quantity}
                    onChange={(event) => {
                      const quantityValue = event.target.value;

                      setForm((prev) => ({
                        ...prev,
                        quantity: quantityValue,
                        refundAmount:
                          prev.refundGiven && selectedLine
                            ? getSuggestedRefundAmount(selectedLine, quantityValue)
                            : prev.refundAmount,
                      }));
                    }}
                  />
                </label>

                <label>
                  Reason
                  <textarea
                    required
                    rows={4}
                    value={form.reason}
                    onChange={(event) => setForm((prev) => ({ ...prev, reason: event.target.value }))}
                  />
                </label>

                <label>
                  Claim Action
                  <select
                    value={form.replacementGiven ? "replacement" : "refund"}
                    onChange={(event) => {
                      const value = event.target.value;
                      setForm((prev) => ({
                        ...prev,
                        replacementGiven: value === "replacement",
                        refundGiven: value === "refund",
                        refundAmount:
                          value === "refund"
                            ? getSuggestedRefundAmount(selectedLine, prev.quantity)
                            : "",
                      }));
                    }}
                  >
                    <option value="replacement">Replacement Given</option>
                    <option value="refund">Refund Given</option>
                  </select>
                </label>

                {form.refundGiven ? (
                  <label>
                    Refund Amount
                    <input
                      required
                      type="number"
                      min="0.01"
                      step="0.01"
                      value={form.refundAmount}
                      onChange={(event) => setForm((prev) => ({ ...prev, refundAmount: event.target.value }))}
                    />
                    <small className="editor-subtitle" style={{ marginTop: "0.3rem", display: "block" }}>
                      Suggested from selected product and quantity.
                    </small>
                  </label>
                ) : null}

                <label>
                  Notes (Optional)
                  <textarea
                    rows={3}
                    value={form.notes}
                    onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))}
                  />
                </label>

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={() => closeBuilder()}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? "Saving..." : "Create Claim"}
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

export default ClaimsPage;
