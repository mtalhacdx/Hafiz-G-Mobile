import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import { useSmartPopup } from "../components/SmartPopupProvider";
import client from "../api/client";
import useToastMessage from "../hooks/useToastMessage";

const emptyForm = {
  categoryName: "",
  description: "",
};

const PAGE_SIZE = 10;

const dateTime = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
  timeStyle: "short",
});

const CategoriesPage = () => {
  const popup = useSmartPopup();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [editorOpen, setEditorOpen] = useState(false);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const hasEditorChanges = useMemo(() => JSON.stringify(form) !== JSON.stringify(emptyForm), [form]);
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();

  const loadCategories = async () => {
    const params = {};
    if (search.trim()) {
      params.search = search.trim();
    }

    const response = await client.get("/categories", { params });
    setCategories(response.data?.data || []);
  };

  const loadBase = async () => {
    try {
      setLoading(true);
      setError("");

      const [categoryRes, productRes] = await Promise.all([
        client.get("/categories"),
        client.get("/products"),
      ]);

      setCategories(categoryRes.data?.data || []);
      setProducts(productRes.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load categories page");
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
        loadCategories().catch((fetchError) => {
          setError(fetchError.response?.data?.message || "Failed to filter categories");
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

  const categoryProductCount = useMemo(() => {
    return products.reduce((map, product) => {
      const categoryId = product.categoryId?._id || product.categoryId;
      if (!categoryId) {
        return map;
      }

      map[categoryId] = (map[categoryId] || 0) + 1;
      return map;
    }, {});
  }, [products]);

  const stats = useMemo(() => {
    const activeCategories = categories.filter((item) => item.isActive !== false).length;
    const inactiveCategories = categories.length - activeCategories;
    const withDescriptions = categories.filter((item) => item.description?.trim()).length;

    return {
      total: categories.length,
      active: activeCategories,
      inactive: inactiveCategories,
      withDescriptions,
    };
  }, [categories]);

  const selectedCategoryProducts = useMemo(() => {
    if (!selectedCategory) {
      return [];
    }

    return products.filter((product) => {
      const categoryId = product.categoryId?._id || product.categoryId;
      return categoryId === selectedCategory._id;
    });
  }, [products, selectedCategory]);

  const totalPages = Math.max(1, Math.ceil(categories.length / PAGE_SIZE));

  const paginatedCategories = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return categories.slice(startIndex, startIndex + PAGE_SIZE);
  }, [categories, page]);

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
    setEditingCategory(null);
    setForm(emptyForm);
    setEditorOpen(true);
    setNotice("");
  };

  const openEdit = (category) => {
    setEditingCategory(category);
    setForm({
      categoryName: category.categoryName || "",
      description: category.description || "",
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
        title: "Discard Category Changes",
        message: "You have unsaved category changes. Discard them?",
        confirmText: "Discard",
      });

      if (!confirmed) {
        return;
      }
    }

    setEditorOpen(false);
    setEditingCategory(null);
    setForm(emptyForm);
  };

  const openDetails = (category) => {
    setSelectedCategory(category);
    setDetailsOpen(true);
  };

  const closeDetails = () => {
    setDetailsOpen(false);
    setSelectedCategory(null);
  };

  const submitCategory = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const payload = {
        categoryName: form.categoryName.trim(),
        description: form.description.trim(),
      };

      if (editingCategory) {
        await client.put(`/categories/${editingCategory._id}`, payload);
        setNotice("Category updated successfully");
      } else {
        await client.post("/categories", payload);
        setNotice("Category created successfully");
      }

      await closeEditor(true);
      await loadBase();
      setPage(1);
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Failed to save category");
    } finally {
      setSaving(false);
    }
  };

  const deactivateCategory = async (categoryId) => {
    const confirmed = await popup.confirm({
      title: "Deactivate Category",
      message: "Deactivate this category?",
      confirmText: "Deactivate",
    });
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await client.delete(`/categories/${categoryId}`);
      setNotice("Category deactivated");
      await loadBase();
      setPage(1);
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || "Failed to deactivate category");
    }
  };

  const activateCategory = async (category) => {
    const confirmed = await popup.confirm({
      title: "Activate Category",
      message: "Activate this category?",
      confirmText: "Activate",
    });
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await client.put(`/categories/${category._id}`, {
        categoryName: category.categoryName,
        description: category.description || "",
        isActive: true,
      });
      setNotice("Category activated");
      await loadBase();
      setPage(1);
    } catch (activateError) {
      setError(activateError.response?.data?.message || "Failed to activate category");
    }
  };

  const detailsStock = selectedCategoryProducts.reduce(
    (sum, product) => sum + Number(product.stockQuantity || 0),
    0
  );
  const detailsStockValue = selectedCategoryProducts.reduce(
    (sum, product) => sum + Number(product.stockQuantity || 0) * Number(product.purchasePrice || 0),
    0
  );
  const showingFrom = categories.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, categories.length);

  return (
    <Layout title="Categories">
      <div className="categories-wrap">
        <section className="categories-hero">
          <div>
            <p className="hero-eyebrow">Catalog Structure</p>
            <h2>Keep product groups organized and easy to manage</h2>
          </div>
          <button className="primary-btn" type="button" onClick={openCreate}>
            Add Category
          </button>
        </section>

        <div className="categories-stats">
          <article className="product-stat-card">
            <p>Total Categories</p>
            <h3>{stats.total}</h3>
          </article>
          <article className="product-stat-card">
            <p>Active Categories</p>
            <h3>{stats.active}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>Inactive Categories</p>
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
            placeholder="Search by category name"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </section>

        {notice ? <p key={noticeKey} className="success-text">{notice}</p> : null}
        {error ? <p key={errorKey} className="error-text">{error}</p> : null}

        <section className="products-table-card">
          {loading ? (
            <p>Loading categories...</p>
          ) : (
            <div className="products-table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Category Name</th>
                    <th>Description</th>
                    <th>Products</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {categories.length === 0 ? (
                    <tr>
                      <td colSpan="5">No categories found.</td>
                    </tr>
                  ) : (
                    paginatedCategories.map((category) => {
                      const productCount = categoryProductCount[category._id] || 0;
                      const active = category.isActive !== false;

                      return (
                        <tr key={category._id}>
                          <td>{category.categoryName}</td>
                          <td>{category.description?.trim() || "-"}</td>
                          <td>{productCount}</td>
                          <td>
                            <span className={`stock-pill ${active ? "ok" : "low"}`}>
                              {active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="table-actions">
                            <button type="button" onClick={() => openDetails(category)}>
                              View
                            </button>
                            <button type="button" onClick={() => openEdit(category)}>
                              Edit
                            </button>
                            {active ? (
                              <button type="button" onClick={() => deactivateCategory(category._id)}>
                                Deactivate
                              </button>
                            ) : (
                              <button type="button" onClick={() => activateCategory(category)}>
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

          {!loading && categories.length > PAGE_SIZE ? (
            <div className="table-pagination">
              <p>
                Showing {showingFrom}-{showingTo} of {categories.length}
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
                  <p className="hero-eyebrow">Category Editor</p>
                  <h3>{editingCategory ? "Edit Category" : "Add Category"}</h3>
                  <p className="editor-subtitle">
                    {editingCategory
                      ? "Update naming and description for cleaner product grouping."
                      : "Create a category to keep your product catalog structured."}
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={() => closeEditor()}>
                  Close
                </button>
              </div>

              <form className="editor-form categories-form" onSubmit={submitCategory}>
                <label>
                  Category Name
                  <input
                    required
                    minLength={2}
                    value={form.categoryName}
                    onChange={(event) => setForm((prev) => ({ ...prev, categoryName: event.target.value }))}
                  />
                </label>

                <label className="categories-form-full">
                  Description
                  <textarea
                    rows={4}
                    value={form.description}
                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                    placeholder="Optional notes about this category"
                  />
                </label>

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={() => closeEditor()}>
                    Cancel
                  </button>
                  <button className="primary-btn" type="submit" disabled={saving}>
                    {saving ? "Saving..." : editingCategory ? "Update Category" : "Create Category"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {detailsOpen && selectedCategory ? (
          <div className="editor-modal" role="dialog" aria-modal="true">
            <button className="editor-backdrop" type="button" onClick={closeDetails} aria-label="Close" />
            <section className="editor-card modal category-details-modal">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Category Details</p>
                  <h3>{selectedCategory.categoryName}</h3>
                  <p className="editor-subtitle">
                    {selectedCategory.description?.trim() || "No description added for this category."}
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={closeDetails}>
                  Close
                </button>
              </div>

              <div className="category-details-body">
                <div className="category-details-grid">
                  <article className="detail-mini-card">
                    <p>Status</p>
                    <h4>{selectedCategory.isActive !== false ? "Active" : "Inactive"}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Products</p>
                    <h4>{selectedCategoryProducts.length}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Total Units</p>
                    <h4>{detailsStock}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Stock Value</p>
                    <h4>PKR {detailsStockValue.toLocaleString()}</h4>
                  </article>
                </div>

                <div className="category-meta-row">
                  <span>Created: {dateTime.format(new Date(selectedCategory.createdAt))}</span>
                  <span>Updated: {dateTime.format(new Date(selectedCategory.updatedAt))}</span>
                </div>

                <section className="category-product-list">
                  <h4>Products in this category</h4>
                  {selectedCategoryProducts.length === 0 ? (
                    <p>No products mapped to this category yet.</p>
                  ) : (
                    <div className="products-table-scroll">
                      <table className="products-table">
                        <thead>
                          <tr>
                            <th>Name</th>
                            <th>Stock</th>
                            <th>Purchase Price</th>
                            <th>Sale Price</th>
                          </tr>
                        </thead>
                        <tbody>
                          {selectedCategoryProducts.map((product) => (
                            <tr key={product._id}>
                              <td>{product.name}</td>
                              <td>{product.stockQuantity}</td>
                              <td>PKR {Number(product.purchasePrice || 0).toLocaleString()}</td>
                              <td>PKR {Number(product.salePrice || 0).toLocaleString()}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </section>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </Layout>
  );
};

export default CategoriesPage;
