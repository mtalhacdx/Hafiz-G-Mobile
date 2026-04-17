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

const emptyForm = {
  name: "",
  phone: "",
  address: "",
};

const SuppliersPage = () => {
  const popup = useSmartPopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [suppliers, setSuppliers] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();

  const [search, setSearch] = useState("");
  const [payableOnly, setPayableOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [editorOpen, setEditorOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingSupplier, setEditingSupplier] = useState(null);
  const [selectedSupplier, setSelectedSupplier] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const hasEditorChanges = useMemo(() => JSON.stringify(form) !== JSON.stringify(emptyForm), [form]);

  const loadSuppliers = async () => {
    const params = { includeInactive: true };
    if (search.trim()) {
      params.search = search.trim();
    }

    const response = await client.get("/suppliers", { params });
    setSuppliers(response.data?.data || []);
  };

  const loadBase = async () => {
    try {
      setLoading(true);
      setError("");

      const [supplierRes, purchaseRes] = await Promise.all([
        client.get("/suppliers", { params: { includeInactive: true } }),
        client.get("/purchases"),
      ]);

      setSuppliers(supplierRes.data?.data || []);
      setPurchases(purchaseRes.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load suppliers page");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBase();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!loading) {
        loadSuppliers().catch((fetchError) => {
          setError(fetchError.response?.data?.message || "Failed to filter suppliers");
        });
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [search, payableOnly]);

  useEffect(() => {
    if (!editorOpen && !viewOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (editorOpen) {
          closeEditor();
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
  }, [editorOpen, viewOpen, form, saving]);

  const stats = useMemo(() => {
    const activeSuppliers = suppliers.filter((supplier) => supplier.isActive !== false);
    const payableSuppliers = suppliers.filter(
      (supplier) => supplier.isActive !== false && Number(supplier.balance || 0) > 0
    ).length;
    const totalPayable = suppliers.reduce((sum, supplier) => sum + Number(supplier.balance || 0), 0);

    return {
      totalSuppliers: activeSuppliers.length,
      inactiveSuppliers: suppliers.length - activeSuppliers.length,
      payableSuppliers,
      totalPayable,
      averagePayable: payableSuppliers ? totalPayable / payableSuppliers : 0,
    };
  }, [suppliers]);

  const filteredSuppliers = useMemo(() => {
    if (!payableOnly) {
      return suppliers;
    }

    return suppliers.filter((supplier) => Number(supplier.balance || 0) > 0);
  }, [suppliers, payableOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredSuppliers.length / PAGE_SIZE));

  const paginatedSuppliers = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredSuppliers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredSuppliers, page]);

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

  const selectedSupplierPurchases = useMemo(() => {
    if (!selectedSupplier) {
      return [];
    }

    return purchases.filter((invoice) => {
      const supplierId = invoice.supplierId?._id || invoice.supplierId;
      return supplierId === selectedSupplier._id;
    });
  }, [purchases, selectedSupplier]);

  const selectedSupplierStats = useMemo(() => {
    const purchased = selectedSupplierPurchases.reduce(
      (sum, invoice) => sum + Number(invoice.totalAmount || 0),
      0
    );
    const paid = selectedSupplierPurchases.reduce(
      (sum, invoice) => sum + Number(invoice.paidAmount || 0),
      0
    );

    return {
      invoices: selectedSupplierPurchases.length,
      purchased,
      paid,
      due: Math.max(0, purchased - paid),
    };
  }, [selectedSupplierPurchases]);

  const openCreate = () => {
    setEditingSupplier(null);
    setForm(emptyForm);
    setEditorOpen(true);
    setNotice("");
    setError("");
  };

  const openEdit = (supplier) => {
    setEditingSupplier(supplier);
    setForm({
      name: supplier.name || "",
      phone: supplier.phone || "",
      address: supplier.address || "",
    });
    setEditorOpen(true);
    setNotice("");
    setError("");
  };

  const closeEditor = async (force = false) => {
    if (saving) {
      return;
    }

    if (!force && hasEditorChanges) {
      const confirmed = await popup.confirm({
        title: "Discard Supplier Changes",
        message: "You have unsaved supplier changes. Discard them?",
        confirmText: "Discard",
      });

      if (!confirmed) {
        return;
      }
    }

    setEditorOpen(false);
    setEditingSupplier(null);
    setForm(emptyForm);
  };

  const openView = (supplier) => {
    setSelectedSupplier(supplier);
    setViewOpen(true);
  };

  const closeView = () => {
    setSelectedSupplier(null);
    setViewOpen(false);
  };

  const submitSupplier = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload = {
        name: form.name.trim(),
        phone: form.phone.trim(),
        address: form.address.trim(),
      };

      if (editingSupplier) {
        await client.put(`/suppliers/${editingSupplier._id}`, payload);
        setNotice("Supplier updated successfully");
      } else {
        await client.post("/suppliers", payload);
        setNotice("Supplier added successfully");
      }

      await closeEditor(true);
      await loadBase();
      setPage(1);
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Failed to save supplier");
    } finally {
      setSaving(false);
    }
  };

  const deactivateSupplier = async (supplierId) => {
    const confirmed = await popup.confirm({
      title: "Deactivate Supplier",
      message: "Deactivate this supplier?",
      confirmText: "Deactivate",
    });
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await client.delete(`/suppliers/${supplierId}`);
      setNotice("Supplier deactivated");
      await loadBase();
      setPage(1);
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || "Failed to deactivate supplier");
    }
  };

  const activateSupplier = async (supplier) => {
    const confirmed = await popup.confirm({
      title: "Activate Supplier",
      message: "Activate this supplier?",
      confirmText: "Activate",
    });
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await client.put(`/suppliers/${supplier._id}`, {
        name: supplier.name,
        phone: supplier.phone,
        address: supplier.address || "",
        isActive: true,
      });
      setNotice("Supplier activated");
      await loadBase();
      setPage(1);
    } catch (activateError) {
      setError(activateError.response?.data?.message || "Failed to activate supplier");
    }
  };

  const showingFrom = filteredSuppliers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredSuppliers.length);

  return (
    <Layout title="Suppliers">
      <div className="sales-wrap">
        <section className="sales-hero">
          <div>
            <p className="hero-eyebrow">Supplier Desk</p>
            <h2>Manage vendors, payables, and supplier-wise purchase history</h2>
          </div>
          <button type="button" className="primary-btn" onClick={openCreate}>
            Add Supplier
          </button>
        </section>

        <div className="sales-kpis">
          <article className="product-stat-card">
            <p>Total Suppliers</p>
            <h3>{stats.totalSuppliers}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>With Outstanding Payable</p>
            <h3>{stats.payableSuppliers}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>Inactive Suppliers</p>
            <h3>{stats.inactiveSuppliers}</h3>
          </article>
          <article className="product-stat-card">
            <p>Total Payable</p>
            <h3>{currency.format(stats.totalPayable)}</h3>
          </article>
        </div>

        <section className="products-filters">
          <input
            type="search"
            placeholder="Search by supplier name or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div />
          <label className="check-inline">
            <input
              type="checkbox"
              checked={payableOnly}
              onChange={(event) => setPayableOnly(event.target.checked)}
            />
            Payable suppliers only
          </label>
        </section>

        {notice ? <p key={noticeKey} className="success-text">{notice}</p> : null}
        {!editorOpen && !viewOpen && error ? <p key={errorKey} className="error-text">{error}</p> : null}

        <section className="products-table-card">
          {loading ? (
            <p>Loading suppliers...</p>
          ) : (
            <div className="products-table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Phone</th>
                    <th>Address</th>
                    <th>Balance</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSuppliers.length === 0 ? (
                    <tr>
                      <td colSpan="6">No suppliers found.</td>
                    </tr>
                  ) : (
                    paginatedSuppliers.map((supplier) => {
                      const active = supplier.isActive !== false;
                      const hasPayable = Number(supplier.balance || 0) > 0;

                      return (
                        <tr key={supplier._id}>
                          <td>{supplier.name}</td>
                          <td>{supplier.phone}</td>
                          <td>{supplier.address?.trim() || "-"}</td>
                          <td>{currency.format(Number(supplier.balance || 0))}</td>
                          <td>
                            <span
                              className={`payment-pill ${active ? (hasPayable ? "partial" : "paid") : "unpaid"}`}
                            >
                              {active ? (hasPayable ? "Payable" : "Clear") : "Deactive"}
                            </span>
                          </td>
                          <td className="table-actions">
                            <button type="button" onClick={() => openView(supplier)}>
                              View
                            </button>
                            <button type="button" onClick={() => openEdit(supplier)}>
                              Edit
                            </button>
                            {active ? (
                              <button type="button" onClick={() => deactivateSupplier(supplier._id)}>
                                Deactivate
                              </button>
                            ) : (
                              <button type="button" onClick={() => activateSupplier(supplier)}>
                                Activate
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredSuppliers.length > PAGE_SIZE ? (
            <div className="table-pagination">
              <p>
                Showing {showingFrom}-{showingTo} of {filteredSuppliers.length}
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

        {editorOpen ? (
          <div className="editor-modal" role="dialog" aria-modal="true">
            <button className="editor-backdrop" type="button" onClick={() => closeEditor()} aria-label="Close" />
            <section className="editor-card modal customer-modal-card">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Supplier Editor</p>
                  <h3>{editingSupplier ? "Edit Supplier" : "Add Supplier"}</h3>
                  <p className="editor-subtitle">
                    Maintain vendor profiles for reliable purchasing and payable tracking.
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={() => closeEditor()}>
                  Close
                </button>
              </div>

              <form className="editor-form customer-form" onSubmit={submitSupplier}>
                {error ? <p key={errorKey} className="error-text sales-modal-error">{error}</p> : null}

                <label>
                  Supplier Name
                  <input
                    required
                    minLength={2}
                    value={form.name}
                    onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  />
                </label>

                <label>
                  Phone
                  <input
                    required
                    minLength={5}
                    value={form.phone}
                    onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))}
                  />
                </label>

                <label className="customer-form-full">
                  Address
                  <textarea
                    rows={3}
                    value={form.address}
                    onChange={(event) => setForm((prev) => ({ ...prev, address: event.target.value }))}
                    placeholder="Optional supplier address"
                  />
                </label>

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={() => closeEditor()}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? "Saving..." : editingSupplier ? "Update Supplier" : "Create Supplier"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {viewOpen && selectedSupplier ? (
          <div className="editor-modal" role="dialog" aria-modal="true">
            <button className="editor-backdrop" type="button" onClick={closeView} aria-label="Close" />
            <section className="editor-card modal sales-view-card">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Supplier Ledger Snapshot</p>
                  <h3>{selectedSupplier.name}</h3>
                  <p className="editor-subtitle">
                    {selectedSupplier.phone} {selectedSupplier.address ? `• ${selectedSupplier.address}` : ""}
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={closeView}>
                  Close
                </button>
              </div>

              <div className="invoice-view-body">
                <div className="invoice-kpi-grid">
                  <article className="detail-mini-card">
                    <p>Total Purchases</p>
                    <h4>{selectedSupplierStats.invoices}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Total Purchased</p>
                    <h4>{currency.format(selectedSupplierStats.purchased)}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Total Paid</p>
                    <h4>{currency.format(selectedSupplierStats.paid)}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Outstanding Payable</p>
                    <h4>{currency.format(selectedSupplierStats.due)}</h4>
                  </article>
                </div>

                <div className="products-table-scroll">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Purchase</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedSupplierPurchases.length === 0 ? (
                        <tr>
                          <td colSpan="6">No purchases linked to this supplier yet.</td>
                        </tr>
                      ) : (
                        selectedSupplierPurchases.map((invoice) => {
                          const due = Number(invoice.totalAmount || 0) - Number(invoice.paidAmount || 0);
                          return (
                            <tr key={invoice._id}>
                              <td>{invoice.purchaseInvoiceNumber}</td>
                              <td>{dateShort.format(new Date(invoice.date))}</td>
                              <td>{currency.format(Number(invoice.totalAmount || 0))}</td>
                              <td>{currency.format(Number(invoice.paidAmount || 0))}</td>
                              <td>{currency.format(Math.max(0, due))}</td>
                              <td>
                                <span className={`payment-pill ${invoice.paymentStatus || "unpaid"}`}>
                                  {invoice.paymentStatus || "unpaid"}
                                </span>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={closeView}>
                    Close
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

export default SuppliersPage;
