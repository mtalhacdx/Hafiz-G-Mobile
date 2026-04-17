import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { useSmartPopup } from "../components/SmartPopupProvider";
import client from "../api/client";
import useToastMessage from "../hooks/useToastMessage";

const emptyForm = {
  brandName: "",
  description: "",
};

const PAGE_SIZE = 10;

const BrandsPage = () => {
  const popup = useSmartPopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [brands, setBrands] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingBrand, setEditingBrand] = useState(null);
  const [selectedBrand, setSelectedBrand] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const hasEditorChanges = useMemo(() => JSON.stringify(form) !== JSON.stringify(emptyForm), [form]);
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();

  const loadBrands = async () => {
    const params = { includeInactive: true };
    if (search.trim()) {
      params.search = search.trim();
    }

    const response = await client.get("/brands", { params });
    setBrands(response.data?.data || []);
  };

  const loadBase = async () => {
    try {
      setLoading(true);
      setError("");

      const [brandRes, productRes] = await Promise.all([
        client.get("/brands", { params: { includeInactive: true } }),
        client.get("/products"),
      ]);

      setBrands(brandRes.data?.data || []);
      setProducts(productRes.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load brands page");
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
        loadBrands().catch((fetchError) => {
          setError(fetchError.response?.data?.message || "Failed to filter brands");
        });
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [search]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (!editorOpen && !detailsOpen) {
      return;
    }

    const previousOverflow = document.body.style.overflow;
    const onKeyDown = (event) => {
      if (event.key === "Escape") {
        if (editorOpen) {
          closeEditor();
        }
        if (detailsOpen) {
          closeDetails();
        }
      }
    };

    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [editorOpen, detailsOpen, form, saving]);

  const brandProductCount = useMemo(() => {
    return products.reduce((map, product) => {
      const brandName = String(product.brandName || "").trim();
      if (!brandName) {
        return map;
      }

      map[brandName.toLowerCase()] = (map[brandName.toLowerCase()] || 0) + 1;
      return map;
    }, {});
  }, [products]);

  const stats = useMemo(() => {
    const activeBrands = brands.filter((item) => item.isActive !== false).length;
    const inactiveBrands = brands.length - activeBrands;
    const withDescriptions = brands.filter((item) => item.description?.trim()).length;

    return {
      total: brands.length,
      active: activeBrands,
      inactive: inactiveBrands,
      withDescriptions,
    };
  }, [brands]);

  const selectedBrandProducts = useMemo(() => {
    if (!selectedBrand) {
      return [];
    }

    const brandName = String(selectedBrand.brandName || "").trim().toLowerCase();
    return products.filter((product) => String(product.brandName || "").trim().toLowerCase() === brandName);
  }, [products, selectedBrand]);

  const totalPages = Math.max(1, Math.ceil(brands.length / PAGE_SIZE));

  const paginatedBrands = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return brands.slice(startIndex, startIndex + PAGE_SIZE);
  }, [brands, page]);

  const pageRange = useMemo(() => {
    const spread = 2;
    const start = Math.max(1, page - spread);
    const end = Math.min(totalPages, page + spread);
    const pages = [];

    for (let current = start; current <= end; current += 1) {
      pages.push(current);
    }

    return pages;
  }, [page, totalPages]);

  const openCreate = () => {
    setEditingBrand(null);
    setForm(emptyForm);
    setEditorOpen(true);
    setNotice("");
  };

  const openEdit = (brand) => {
    setEditingBrand(brand);
    setForm({
      brandName: brand.brandName || "",
      description: brand.description || "",
    });
    setEditorOpen(true);
    setNotice("");
  };

  const closeEditor = async (force = false) => {
    if (saving) {
      return;
    }

    if (!force && hasEditorChanges) {
      const confirmed = await popup.confirm({
        title: "Discard Brand Changes",
        message: "You have unsaved brand changes. Discard them?",
        confirmText: "Discard",
      });

      if (!confirmed) {
        return;
      }
    }

    setEditorOpen(false);
    setEditingBrand(null);
    setForm(emptyForm);
  };

  const openDetails = (brand) => {
    setSelectedBrand(brand);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedBrand(null);
  };

  const submitBrand = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload = {
        brandName: form.brandName.trim(),
        description: form.description.trim(),
      };

      if (editingBrand) {
        await client.put(`/brands/${editingBrand._id}`, payload);
        setNotice("Brand updated successfully");
      } else {
        await client.post("/brands", payload);
        setNotice("Brand created successfully");
      }

      await closeEditor(true);
      await loadBase();
      setPage(1);
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Failed to save brand");
    } finally {
      setSaving(false);
    }
  };

  const deactivateBrand = async (brandId) => {
    const confirmed = await popup.confirm({
      title: "Deactivate Brand",
      message: "Deactivate this brand?",
      confirmText: "Deactivate",
    });
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await client.delete(`/brands/${brandId}`);
      setNotice("Brand deactivated");
      await loadBase();
      setPage(1);
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || "Failed to deactivate brand");
    }
  };

  const activateBrand = async (brand) => {
    const confirmed = await popup.confirm({
      title: "Activate Brand",
      message: "Activate this brand?",
      confirmText: "Activate",
    });
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await client.put(`/brands/${brand._id}`, {
        brandName: brand.brandName,
        description: brand.description || "",
        isActive: true,
      });
      setNotice("Brand activated");
      await loadBase();
      setPage(1);
    } catch (activateError) {
      setError(activateError.response?.data?.message || "Failed to activate brand");
    }
  };

  const showingFrom = brands.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, brands.length);

  return (
    <Layout title="Brands">
      <div className="categories-wrap">
        <section className="categories-hero">
          <div>
            <p className="hero-eyebrow">Brand Directory</p>
            <h2>Manage product brands for cleaner inventory control</h2>
          </div>
          <button className="primary-btn" type="button" onClick={openCreate}>
            Add Brand
          </button>
        </section>

        <div className="categories-stats">
          <article className="product-stat-card">
            <p>Total Brands</p>
            <h3>{stats.total}</h3>
          </article>
          <article className="product-stat-card">
            <p>Active Brands</p>
            <h3>{stats.active}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>Inactive Brands</p>
            <h3>{stats.inactive}</h3>
          </article>
          <article className="product-stat-card">
            <p>With Description</p>
            <h3>{stats.withDescriptions}</h3>
          </article>
        </div>

        <section className="categories-toolbar">
          <input
            type="search"
            placeholder="Search by brand name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </section>

        {notice ? <p key={noticeKey} className="success-text">{notice}</p> : null}
        {error ? <p key={errorKey} className="error-text">{error}</p> : null}

        <section className="products-table-card">
          {loading ? (
            <p>Loading brands...</p>
          ) : (
            <div className="products-table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Brand Name</th>
                    <th>Description</th>
                    <th>Products</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {brands.length === 0 ? (
                    <tr>
                      <td colSpan="5">No brands found.</td>
                    </tr>
                  ) : (
                    paginatedBrands.map((brand) => {
                      const productCount = brandProductCount[String(brand.brandName || "").trim().toLowerCase()] || 0;
                      const active = brand.isActive !== false;

                      return (
                        <tr key={brand._id}>
                          <td>{brand.brandName}</td>
                          <td>{brand.description?.trim() || "-"}</td>
                          <td>{productCount}</td>
                          <td>
                            <span className={`stock-pill ${active ? "ok" : "low"}`}>
                              {active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="table-actions">
                            <button type="button" onClick={() => openDetails(brand)}>
                              View
                            </button>
                            <button type="button" onClick={() => openEdit(brand)}>
                              Edit
                            </button>
                            {active ? (
                              <button type="button" onClick={() => deactivateBrand(brand._id)}>
                                Deactivate
                              </button>
                            ) : (
                              <button type="button" onClick={() => activateBrand(brand)}>
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

          {!loading && brands.length > PAGE_SIZE ? (
            <div className="table-pagination">
              <p>
                Showing {showingFrom}-{showingTo} of {brands.length}
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
            <section className="editor-card modal categories-modal-card">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Brand Editor</p>
                  <h3>{editingBrand ? "Edit Brand" : "Add Brand"}</h3>
                  <p className="editor-subtitle">
                    {editingBrand
                      ? "Update brand naming and notes for better product grouping."
                      : "Create a brand to organize products across categories."}
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={() => closeEditor()}>
                  Close
                </button>
              </div>

              <form className="editor-form categories-form" onSubmit={submitBrand}>
                <label>
                  Brand Name
                  <input
                    required
                    minLength={2}
                    value={form.brandName}
                    onChange={(event) => setForm((prev) => ({ ...prev, brandName: event.target.value }))}
                  />
                </label>

                <label>
                  Description (Optional)
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                  />
                </label>

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={() => closeEditor()}>
                    Cancel
                  </button>
                  <button type="submit" className="primary-btn" disabled={saving}>
                    {saving ? "Saving..." : editingBrand ? "Update Brand" : "Create Brand"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {detailsOpen && selectedBrand ? (
          <div className="editor-modal" role="dialog" aria-modal="true">
            <button className="editor-backdrop" type="button" onClick={closeDetails} aria-label="Close" />
            <section className="editor-card modal categories-view-card brand-details-modal">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Brand Details</p>
                  <h3>{selectedBrand.brandName}</h3>
                  <p className="editor-subtitle">Products linked with this brand and current brand status.</p>
                </div>
                <button type="button" className="ghost-btn" onClick={closeDetails}>
                  Close
                </button>
              </div>

              <div className="category-details-body brand-details-body">
                <div className="category-details-grid brand-details-grid">
                  <article className="detail-mini-card">
                    <p>Status</p>
                    <h4>{selectedBrand.isActive !== false ? "Active" : "Inactive"}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Products Using This Brand</p>
                    <h4>{selectedBrandProducts.length}</h4>
                  </article>
                </div>

                <div className="category-description-box brand-description-box">
                  <h4>Description</h4>
                  <p>{selectedBrand.description?.trim() || "No description provided"}</p>
                </div>

                <div className="products-table-scroll brand-products-scroll">
                  <table className="products-table">
                    <thead>
                      <tr>
                        <th>Product</th>
                        <th>Category</th>
                        <th>Stock</th>
                        <th>Sale Price</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedBrandProducts.length === 0 ? (
                        <tr>
                          <td colSpan="4">No products linked with this brand.</td>
                        </tr>
                      ) : (
                        selectedBrandProducts.map((product) => (
                          <tr key={product._id}>
                            <td>{product.name}</td>
                            <td>{product.categoryId?.categoryName || "-"}</td>
                            <td>{product.stockQuantity || 0}</td>
                            <td>{product.salePrice || 0}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </Layout>
  );
};

export default BrandsPage;
