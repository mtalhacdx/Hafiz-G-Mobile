import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
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

const CustomersPage = () => {
  const popup = useSmartPopup();
  const admin = useSelector((state) => state.auth.admin);
  const isSmallManager = (admin?.role || "admin") === "small_manager";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [customers, setCustomers] = useState([]);
  const [sales, setSales] = useState([]);
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();

  const [search, setSearch] = useState("");
  const [dueOnly, setDueOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [editorOpen, setEditorOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingCustomer, setEditingCustomer] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const hasEditorChanges = useMemo(() => JSON.stringify(form) !== JSON.stringify(emptyForm), [form]);

  const loadCustomers = async () => {
    const params = { includeInactive: true };
    if (search.trim()) {
      params.search = search.trim();
    }

    const response = await client.get("/customers", { params });
    setCustomers(response.data?.data || []);
  };

  const loadBase = async () => {
    try {
      setLoading(true);
      setError("");

      const [customerRes, salesRes] = await Promise.all([
        client.get("/customers", { params: { includeInactive: true } }),
        client.get("/sales"),
      ]);
      setCustomers(customerRes.data?.data || []);
      setSales(salesRes.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load customers page");
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
        loadCustomers().catch((fetchError) => {
          setError(fetchError.response?.data?.message || "Failed to filter customers");
        });
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [search, dueOnly]);

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
    const activeCustomers = customers.filter((customer) => customer.isActive !== false);
    const totalReceivable = customers.reduce((sum, customer) => sum + Number(customer.balance || 0), 0);
    const dueCustomers = customers.filter(
      (customer) => customer.isActive !== false && Number(customer.balance || 0) > 0
    ).length;

    return {
      totalCustomers: activeCustomers.length,
      inactiveCustomers: customers.length - activeCustomers.length,
      dueCustomers,
      totalReceivable,
      averageReceivable: dueCustomers ? totalReceivable / dueCustomers : 0,
    };
  }, [customers]);

  const filteredCustomers = useMemo(() => {
    if (!dueOnly) {
      return customers;
    }

    return customers.filter((customer) => Number(customer.balance || 0) > 0);
  }, [customers, dueOnly]);

  const totalPages = Math.max(1, Math.ceil(filteredCustomers.length / PAGE_SIZE));

  const paginatedCustomers = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return filteredCustomers.slice(startIndex, startIndex + PAGE_SIZE);
  }, [filteredCustomers, page]);

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

  const selectedCustomerInvoices = useMemo(() => {
    if (!selectedCustomer) {
      return [];
    }

    return sales.filter((invoice) => {
      const customerId = invoice.customerId?._id || invoice.customerId;
      return customerId === selectedCustomer._id;
    });
  }, [sales, selectedCustomer]);

  const selectedCustomerStats = useMemo(() => {
    const billed = selectedCustomerInvoices.reduce(
      (sum, invoice) => sum + Number(invoice.grandTotal || 0),
      0
    );
    const paid = selectedCustomerInvoices.reduce((sum, invoice) => sum + Number(invoice.paidAmount || 0), 0);

    return {
      invoices: selectedCustomerInvoices.length,
      billed,
      paid,
      due: Math.max(0, billed - paid),
    };
  }, [selectedCustomerInvoices]);

  const openCreate = () => {
    setEditingCustomer(null);
    setForm(emptyForm);
    setEditorOpen(true);
    setNotice("");
    setError("");
  };

  const openEdit = (customer) => {
    setEditingCustomer(customer);
    setForm({
      name: customer.name || "",
      phone: customer.phone || "",
      address: customer.address || "",
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
        title: "Discard Customer Changes",
        message: "You have unsaved customer changes. Discard them?",
        confirmText: "Discard",
      });

      if (!confirmed) {
        return;
      }
    }

    setEditorOpen(false);
    setEditingCustomer(null);
    setForm(emptyForm);
  };

  const openView = (customer) => {
    setSelectedCustomer(customer);
    setViewOpen(true);
  };

  const closeView = () => {
    setSelectedCustomer(null);
    setViewOpen(false);
  };

  const submitCustomer = async (event) => {
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

      if (editingCustomer) {
        await client.put(`/customers/${editingCustomer._id}`, payload);
        setNotice("Customer updated successfully");
      } else {
        await client.post("/customers", payload);
        setNotice("Customer added successfully");
      }

      await closeEditor(true);
      await loadBase();
      setPage(1);
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Failed to save customer");
    } finally {
      setSaving(false);
    }
  };

  const deactivateCustomer = async (customerId) => {
    const confirmed = await popup.confirm({
      title: "Deactivate Customer",
      message: "Deactivate this customer?",
      confirmText: "Deactivate",
    });
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await client.delete(`/customers/${customerId}`);
      setNotice("Customer deactivated");
      await loadBase();
      setPage(1);
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || "Failed to deactivate customer");
    }
  };

  const activateCustomer = async (customer) => {
    const confirmed = await popup.confirm({
      title: "Activate Customer",
      message: "Activate this customer?",
      confirmText: "Activate",
    });
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await client.put(`/customers/${customer._id}`, {
        name: customer.name,
        phone: customer.phone,
        address: customer.address || "",
        isActive: true,
      });
      setNotice("Customer activated");
      await loadBase();
      setPage(1);
    } catch (activateError) {
      setError(activateError.response?.data?.message || "Failed to activate customer");
    }
  };

  const showingFrom = filteredCustomers.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, filteredCustomers.length);

  return (
    <Layout title="Customers">
      <div className="sales-wrap">
        <section className="sales-hero">
          <div>
            <p className="hero-eyebrow">Customer Desk</p>
            <h2>Manage clients, receivables, and customer-wise invoice history</h2>
          </div>
          <button type="button" className="primary-btn" onClick={openCreate}>
            Add Customer
          </button>
        </section>

        <div className="sales-kpis">
          <article className="product-stat-card">
            <p>Total Customers</p>
            <h3>{stats.totalCustomers}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>With Outstanding Due</p>
            <h3>{stats.dueCustomers}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>Inactive Customers</p>
            <h3>{stats.inactiveCustomers}</h3>
          </article>
          <article className="product-stat-card">
            <p>Total Receivable</p>
            <h3>{currency.format(stats.totalReceivable)}</h3>
          </article>
          <article className="product-stat-card">
            <p>Avg Receivable</p>
            <h3>{currency.format(stats.averageReceivable)}</h3>
          </article>
        </div>

        <section className="products-filters">
          <input
            type="search"
            placeholder="Search by customer name or phone"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <div />
          <label className="check-inline">
            <input
              type="checkbox"
              checked={dueOnly}
              onChange={(event) => setDueOnly(event.target.checked)}
            />
            Due customers only
          </label>
        </section>

        {notice ? <p key={noticeKey} className="success-text">{notice}</p> : null}
        {!editorOpen && !viewOpen && error ? <p key={errorKey} className="error-text">{error}</p> : null}

        <section className="products-table-card">
          {loading ? (
            <p>Loading customers...</p>
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
                  {filteredCustomers.length === 0 ? (
                    <tr>
                      <td colSpan="6">No customers found.</td>
                    </tr>
                  ) : (
                    paginatedCustomers.map((customer) => {
                      const active = customer.isActive !== false;
                      const hasDue = Number(customer.balance || 0) > 0;
                      return (
                        <tr key={customer._id}>
                          <td>{customer.name}</td>
                          <td>{customer.phone}</td>
                          <td>{customer.address?.trim() || "-"}</td>
                          <td>{currency.format(Number(customer.balance || 0))}</td>
                          <td>
                            <span className={`payment-pill ${active ? (hasDue ? "partial" : "paid") : "unpaid"}`}>
                              {active ? (hasDue ? "Due" : "Clear") : "Deactive"}
                            </span>
                          </td>
                          <td className="table-actions">
                            <button type="button" onClick={() => openView(customer)}>
                              View
                            </button>
                            <button type="button" onClick={() => openEdit(customer)}>
                              Edit
                            </button>
                            {!isSmallManager
                              ? active
                                ? (
                                  <button type="button" onClick={() => deactivateCustomer(customer._id)}>
                                    Deactivate
                                  </button>
                                  )
                                : (
                                  <button type="button" onClick={() => activateCustomer(customer)}>
                                    Activate
                                  </button>
                                  )
                              : null}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          )}

          {!loading && filteredCustomers.length > PAGE_SIZE ? (
            <div className="table-pagination">
              <p>
                Showing {showingFrom}-{showingTo} of {filteredCustomers.length}
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
                  <p className="hero-eyebrow">Customer Editor</p>
                  <h3>{editingCustomer ? "Edit Customer" : "Add Customer"}</h3>
                  <p className="editor-subtitle">
                    Keep customer records clean for accurate billing and receivable tracking.
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={() => closeEditor()}>
                  Close
                </button>
              </div>

              <form className="editor-form customer-form" onSubmit={submitCustomer}>
                {error ? <p key={errorKey} className="error-text sales-modal-error">{error}</p> : null}

                <label>
                  Customer Name
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
                    placeholder="Optional customer address"
                  />
                </label>

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={() => closeEditor()}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? "Saving..." : editingCustomer ? "Update Customer" : "Create Customer"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {viewOpen && selectedCustomer ? (
          <div className="editor-modal" role="dialog" aria-modal="true">
            <button className="editor-backdrop" type="button" onClick={closeView} aria-label="Close" />
            <section className="editor-card modal sales-view-card">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Customer Ledger Snapshot</p>
                  <h3>{selectedCustomer.name}</h3>
                  <p className="editor-subtitle">
                    {selectedCustomer.phone} {selectedCustomer.address ? `• ${selectedCustomer.address}` : ""}
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={closeView}>
                  Close
                </button>
              </div>

              <div className="invoice-view-body">
                <div className="invoice-kpi-grid">
                  <article className="detail-mini-card">
                    <p>Total Invoices</p>
                    <h4>{selectedCustomerStats.invoices}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Total Billed</p>
                    <h4>{currency.format(selectedCustomerStats.billed)}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Total Paid</p>
                    <h4>{currency.format(selectedCustomerStats.paid)}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Outstanding Due</p>
                    <h4>{currency.format(selectedCustomerStats.due)}</h4>
                  </article>
                </div>

                <div className="products-table-scroll">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Date</th>
                        <th>Total</th>
                        <th>Paid</th>
                        <th>Due</th>
                        <th>Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedCustomerInvoices.length === 0 ? (
                        <tr>
                          <td colSpan="6">No invoices linked to this customer yet.</td>
                        </tr>
                      ) : (
                        selectedCustomerInvoices.map((invoice) => {
                          const due = Number(invoice.grandTotal || 0) - Number(invoice.paidAmount || 0);
                          return (
                            <tr key={invoice._id}>
                              <td>{invoice.invoiceNumber}</td>
                              <td>{dateShort.format(new Date(invoice.date))}</td>
                              <td>{currency.format(Number(invoice.grandTotal || 0))}</td>
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

export default CustomersPage;
