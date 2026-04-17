import { useEffect, useMemo, useState } from "react";
import { useSelector } from "react-redux";
import Layout from "../components/Layout";
import { useSmartPopup } from "../components/SmartPopupProvider";
import client from "../api/client";
import useToastMessage from "../hooks/useToastMessage";

const currency = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const emptyForm = {
  name: "",
  brandName: "",
  categoryId: "",
  purchasePrice: "",
  salePrice: "",
  minStockLevel: "10",
  stockQuantity: "",
};

const PAGE_SIZE = 10;

const ProductsPage = () => {
  const popup = useSmartPopup();
  const admin = useSelector((state) => state.auth.admin);
  const isSmallManager = (admin?.role || "admin") === "small_manager";
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [brands, setBrands] = useState([]);
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("");
  const [selectedBrand, setSelectedBrand] = useState("");
  const [lowStockOnly, setLowStockOnly] = useState(false);
  const [page, setPage] = useState(1);

  const [editorOpen, setEditorOpen] = useState(false);
  const [viewOpen, setViewOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState(null);
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const hasEditorChanges = useMemo(() => JSON.stringify(form) !== JSON.stringify(emptyForm), [form]);

  const loadProducts = async () => {
    const params = {};

    if (search.trim()) {
      params.search = search.trim();
    }
    if (selectedCategory) {
      params.categoryId = selectedCategory;
    }
    if (selectedBrand) {
      params.brandName = selectedBrand;
    }
    if (lowStockOnly) {
      params.lowStock = true;
    }

    const productRes = await client.get("/products", { params });
    setProducts(productRes.data?.data || []);
  };

  const loadBase = async () => {
    try {
      setLoading(true);
      setError("");

      const [categoryRes, brandRes] = await Promise.all([
        client.get("/categories"),
        client.get("/brands", { params: { includeInactive: true } }),
      ]);
      setCategories((categoryRes.data?.data || []).filter((item) => item.isActive !== false));
      setBrands(brandRes.data?.data || []);

      await loadProducts();
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load products page");
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
        loadProducts().catch((fetchError) => {
          setError(fetchError.response?.data?.message || "Failed to filter products");
        });
      }
    }, 260);

    return () => clearTimeout(timer);
  }, [search, selectedCategory, selectedBrand, lowStockOnly]);

  useEffect(() => {
    setPage(1);
  }, [search, selectedCategory, selectedBrand, lowStockOnly]);

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
    const lowStockCount = products.filter(
      (item) => Number(item.stockQuantity || 0) <= Number(item.minStockLevel || 0)
    ).length;
    const stockValue = products.reduce(
      (sum, item) => sum + Number(item.stockQuantity || 0) * Number(item.purchasePrice || 0),
      0
    );

    return {
      totalProducts: products.length,
      lowStockCount,
      stockValue,
    };
  }, [products]);

  const brandOptions = useMemo(() => {
    return (brands || [])
      .filter((brand) => brand.isActive !== false)
      .map((brand) => brand.brandName)
      .filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
  }, [brands]);

  const totalPages = Math.max(1, Math.ceil(products.length / PAGE_SIZE));

  const paginatedProducts = useMemo(() => {
    const startIndex = (page - 1) * PAGE_SIZE;
    return products.slice(startIndex, startIndex + PAGE_SIZE);
  }, [products, page]);

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

  const showingFrom = products.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const showingTo = Math.min(page * PAGE_SIZE, products.length);

  const openCreate = () => {
    if (isSmallManager) {
      setError("Small manager can view stock but cannot create or edit products");
      return;
    }

    setEditingProduct(null);
    setForm(emptyForm);
    setEditorOpen(true);
    setNotice("");
  };

  const openEdit = (product) => {
    if (isSmallManager) {
      setError("Small manager cannot edit product catalog");
      return;
    }

    setEditingProduct(product);
    setForm({
      name: product.name || "",
      brandName: product.brandName || "",
      categoryId: product.categoryId?._id || product.categoryId || "",
      purchasePrice: String(product.purchasePrice || ""),
      salePrice: String(product.salePrice || ""),
      minStockLevel: String(product.minStockLevel || ""),
      stockQuantity: String(product.stockQuantity || ""),
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
        title: "Discard Product Changes",
        message: "You have unsaved product changes. Discard them?",
        confirmText: "Discard",
      });

      if (!confirmed) {
        return;
      }
    }

    setEditorOpen(false);
    setEditingProduct(null);
    setForm(emptyForm);
  };

  const openView = (product) => {
    setSelectedProduct(product);
    setViewOpen(true);
  };

  const closeView = () => {
    setSelectedProduct(null);
    setViewOpen(false);
  };

  const onFieldChange = (key, value) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const submitProduct = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setNotice("");

      const basePayload = {
        name: form.name.trim(),
        brandName: form.brandName.trim(),
        categoryId: form.categoryId,
        purchasePrice: Number(form.purchasePrice),
        salePrice: Number(form.salePrice),
        minStockLevel: Number(form.minStockLevel),
      };

      if (editingProduct) {
        await client.put(`/products/${editingProduct._id}`, basePayload);
        setNotice("Product updated successfully");
      } else {
        await client.post("/products", {
          ...basePayload,
          stockQuantity: Number(form.stockQuantity),
        });
        setNotice("Product added successfully");
      }

      await closeEditor(true);
      await loadProducts();
    } catch (saveError) {
      setError(saveError.response?.data?.message || "Failed to save product");
    } finally {
      setSaving(false);
    }
  };

  const deleteProduct = async (productId) => {
    if (isSmallManager) {
      setError("Small manager cannot delete products");
      return;
    }

    const confirmed = await popup.confirm({
      title: "Delete Product",
      message: "Delete this product from active list?",
      confirmText: "Delete",
    });
    if (!confirmed) {
      return;
    }

    try {
      setError("");
      setNotice("");
      await client.delete(`/products/${productId}`);
      setNotice("Product deleted successfully");
      await loadProducts();
      setPage(1);
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || "Failed to delete product");
    }
  };

  return (
    <Layout title="Products">
      <div className="products-wrap">
        <section className="products-hero">
          <div>
            <p className="hero-eyebrow">Inventory Control</p>
            <h2>Manage product catalog and stock thresholds</h2>
          </div>
          {!isSmallManager ? (
            <button className="primary-btn" type="button" onClick={openCreate}>
              Add Product
            </button>
          ) : (
            <span className="payment-pill partial">Read Only Access</span>
          )}
        </section>

        <div className="products-stats">
          <article className="product-stat-card">
            <p>Total Products</p>
            <h3>{stats.totalProducts}</h3>
          </article>
          <article className="product-stat-card warning">
            <p>Low Stock Items</p>
            <h3>{stats.lowStockCount}</h3>
          </article>
          <article className="product-stat-card">
            <p>Inventory Value</p>
            <h3>{currency.format(stats.stockValue)}</h3>
          </article>
        </div>

        <section className="products-filters">
          <input
            type="search"
            placeholder="Search by product name or brand"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <select
            value={selectedBrand}
            onChange={(event) => setSelectedBrand(event.target.value)}
          >
            <option value="">All Brands</option>
            {brandOptions.map((brand) => (
              <option key={brand} value={brand}>
                {brand}
              </option>
            ))}
          </select>
          <select
            value={selectedCategory}
            onChange={(event) => setSelectedCategory(event.target.value)}
          >
            <option value="">All Categories</option>
            {categories.map((category) => (
              <option key={category._id} value={category._id}>
                {category.categoryName}
              </option>
            ))}
          </select>
          <label className="check-inline">
            <input
              type="checkbox"
              checked={lowStockOnly}
              onChange={(event) => setLowStockOnly(event.target.checked)}
            />
            Low stock only
          </label>
        </section>

        {notice ? <p key={noticeKey} className="success-text">{notice}</p> : null}
        {error ? <p key={errorKey} className="error-text">{error}</p> : null}

        <section className="products-table-card">
          {loading ? (
            <p>Loading products...</p>
          ) : (
            <div className="products-table-scroll">
              <table className="products-table">
                <thead>
                  <tr>
                    <th>Sr. No</th>
                    <th>Name</th>
                    <th>Brand</th>
                    <th>Category</th>
                    <th>Purchase</th>
                    <th>Sale</th>
                    <th>Stock</th>
                    <th>Min</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.length === 0 ? (
                    <tr>
                      <td colSpan="10">No products found.</td>
                    </tr>
                  ) : (
                    paginatedProducts.map((product, index) => {
                      const isLow = Number(product.stockQuantity) <= Number(product.minStockLevel);
                      const serialNumber = (page - 1) * PAGE_SIZE + index + 1;
                      return (
                        <tr key={product._id}>
                          <td>{serialNumber}</td>
                          <td>{product.name}</td>
                          <td>{product.brandName || "-"}</td>
                          <td>{product.categoryId?.categoryName || "-"}</td>
                          <td>{currency.format(Number(product.purchasePrice || 0))}</td>
                          <td>{currency.format(Number(product.salePrice || 0))}</td>
                          <td>{product.stockQuantity}</td>
                          <td>{product.minStockLevel}</td>
                          <td>
                            <span className={`stock-pill ${isLow ? "low" : "ok"}`}>
                              {isLow ? "Low" : "Healthy"}
                            </span>
                          </td>
                          <td className="table-actions">
                            <button type="button" onClick={() => openView(product)}>
                              View
                            </button>
                            {!isSmallManager ? (
                              <>
                                <button type="button" onClick={() => openEdit(product)}>
                                  Edit
                                </button>
                                <button type="button" onClick={() => deleteProduct(product._id)}>
                                  Delete
                                </button>
                              </>
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

          {!loading && products.length > PAGE_SIZE ? (
            <div className="table-pagination">
              <p>
                Showing {showingFrom}-{showingTo} of {products.length}
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
            <section className="editor-card modal">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Product Editor</p>
                  <h3>{editingProduct ? "Edit Product" : "Add Product"}</h3>
                  <p className="editor-subtitle">
                    {editingProduct
                      ? "Update catalog details while stock remains system-managed."
                      : "Create a new catalog item with pricing and stock threshold."}
                  </p>
                </div>
                <button type="button" className="ghost-btn" onClick={() => closeEditor()}>
                  Close
                </button>
              </div>

              <form className="editor-form" onSubmit={submitProduct}>
                <label>
                  Product Name
                  <input
                    required
                    value={form.name}
                    onChange={(event) => onFieldChange("name", event.target.value)}
                  />
                </label>

                <label>
                  Brand Name
                  <select
                    required
                    value={form.brandName}
                    onChange={(event) => onFieldChange("brandName", event.target.value)}
                  >
                    <option value="">Select brand</option>
                    {brandOptions.map((brandName) => (
                      <option key={brandName} value={brandName}>
                        {brandName}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Category
                  <select
                    required
                    value={form.categoryId}
                    onChange={(event) => onFieldChange("categoryId", event.target.value)}
                  >
                    <option value="">Select category</option>
                    {categories.map((category) => (
                      <option key={category._id} value={category._id}>
                        {category.categoryName}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Purchase Price
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.purchasePrice}
                    onChange={(event) => onFieldChange("purchasePrice", event.target.value)}
                  />
                </label>

                <label>
                  Sale Price
                  <input
                    required
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.salePrice}
                    onChange={(event) => onFieldChange("salePrice", event.target.value)}
                  />
                </label>

                <label>
                  Minimum Stock Level
                  <input
                    required
                    type="number"
                    min="0"
                    step="1"
                    value={form.minStockLevel}
                    onChange={(event) => onFieldChange("minStockLevel", event.target.value)}
                  />
                </label>

                {!editingProduct ? (
                  <label>
                    Opening Stock
                    <input
                      required
                      type="number"
                      min="0"
                      step="1"
                      value={form.stockQuantity}
                      onChange={(event) => onFieldChange("stockQuantity", event.target.value)}
                    />
                  </label>
                ) : null}

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={() => closeEditor()}>
                    Cancel
                  </button>
                  <button className="primary-btn" type="submit" disabled={saving}>
                    {saving ? "Saving..." : editingProduct ? "Update Product" : "Create Product"}
                  </button>
                </div>
              </form>
            </section>
          </div>
        ) : null}

        {viewOpen && selectedProduct ? (
          <div className="editor-modal" role="dialog" aria-modal="true">
            <button className="editor-backdrop" type="button" onClick={closeView} aria-label="Close" />
            <section className="editor-card modal sales-view-card">
              <div className="editor-head">
                <div>
                  <p className="hero-eyebrow">Product Details</p>
                  <h3>{selectedProduct.name}</h3>
                  <p className="editor-subtitle">Detailed product snapshot for pricing and stock.</p>
                </div>
                <button type="button" className="ghost-btn" onClick={closeView}>
                  Close
                </button>
              </div>

              <div className="invoice-view-body">
                <div className="invoice-kpi-grid">
                  <article className="detail-mini-card">
                    <p>Brand</p>
                    <h4>{selectedProduct.brandName || "-"}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Category</p>
                    <h4>{selectedProduct.categoryId?.categoryName || "-"}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Purchase Price</p>
                    <h4>{currency.format(Number(selectedProduct.purchasePrice || 0))}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Sale Price</p>
                    <h4>{currency.format(Number(selectedProduct.salePrice || 0))}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Inventory Value</p>
                    <h4>
                      {currency.format(
                        Number(selectedProduct.stockQuantity || 0) * Number(selectedProduct.purchasePrice || 0)
                      )}
                    </h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Stock Quantity</p>
                    <h4>{selectedProduct.stockQuantity || 0}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Minimum Stock</p>
                    <h4>{selectedProduct.minStockLevel || 0}</h4>
                  </article>
                  <article className="detail-mini-card">
                    <p>Status</p>
                    <h4>
                      {Number(selectedProduct.stockQuantity || 0) <= Number(selectedProduct.minStockLevel || 0)
                        ? "LOW"
                        : "HEALTHY"}
                    </h4>
                  </article>
                </div>

                <div className="editor-actions">
                  <button type="button" className="ghost-btn" onClick={closeView}>
                    Close
                  </button>
                  {!isSmallManager ? (
                    <button
                      type="button"
                      className="primary-btn"
                      onClick={() => {
                        closeView();
                        openEdit(selectedProduct);
                      }}
                    >
                      Edit Product
                    </button>
                  ) : null}
                </div>
              </div>
            </section>
          </div>
        ) : null}
      </div>
    </Layout>
  );
};

export default ProductsPage;
