import { useEffect, useMemo, useState } from "react";
import Layout from "../components/Layout";
import client from "../api/client";
import useToastMessage from "../hooks/useToastMessage";

const currency = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const sameDay = (a, b) =>
  a.getFullYear() === b.getFullYear() &&
  a.getMonth() === b.getMonth() &&
  a.getDate() === b.getDate();

const toSafeNumber = (value) => Number(value || 0);

const contributesClaimLoss = (claim) => {
  if (["pending", "sent_to_supplier", "rejected"].includes(claim?.status)) {
    return true;
  }

  return claim?.status === "closed" && claim?.supplierStatus === "rejected";
};

const claimLossAmount = (claim) => {
  const explicitLoss = toSafeNumber(claim?.lossAmount);
  if (explicitLoss > 0) {
    return explicitLoss;
  }

  return toSafeNumber(claim?.quantity) * toSafeNumber(claim?.purchasePrice);
};

const DashboardPage = () => {
  const [loading, setLoading] = useState(true);
  const { error, errorKey, setError } = useToastMessage();
  const [sales, setSales] = useState([]);
  const [returnsData, setReturnsData] = useState([]);
  const [claims, setClaims] = useState([]);
  const [purchases, setPurchases] = useState([]);
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [suppliers, setSuppliers] = useState([]);

  useEffect(() => {
    let mounted = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        const [salesRes, returnsRes, claimsRes, purchasesRes, productsRes, customersRes, suppliersRes] = await Promise.all([
          client.get("/sales"),
          client.get("/returns"),
          client.get("/claims"),
          client.get("/purchases"),
          client.get("/products"),
          client.get("/customers"),
          client.get("/suppliers"),
        ]);

        if (!mounted) {
          return;
        }

        setSales(salesRes.data?.data || []);
        setReturnsData(returnsRes.data?.data || []);
        setClaims(claimsRes.data?.data || []);
        setPurchases(purchasesRes.data?.data || []);
        setProducts(productsRes.data?.data || []);
        setCustomers(customersRes.data?.data || []);
        setSuppliers(suppliersRes.data?.data || []);
      } catch (fetchError) {
        if (!mounted) {
          return;
        }

        setError(fetchError.response?.data?.message || "Failed to load dashboard");
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    load();

    return () => {
      mounted = false;
    };
  }, []);

  const metrics = useMemo(() => {
    const now = new Date();
    const todaySalesList = sales.filter((item) => sameDay(new Date(item.date), now));
    const todayReturnsList = returnsData.filter((item) => sameDay(new Date(item.date), now));
    const todayPurchaseList = purchases.filter((item) => {
      const purchaseTime = item.createdAt || item.date;
      return sameDay(new Date(purchaseTime), now);
    });

    const grossTodaySales = todaySalesList.reduce((sum, item) => sum + toSafeNumber(item.grandTotal), 0);
    const todayReturnsAmount = todayReturnsList.reduce(
      (sum, item) => sum + toSafeNumber(item.totalAmount),
      0
    );
    const todaySales = Number((grossTodaySales - todayReturnsAmount).toFixed(2));
    const todayPurchaseCost = todayPurchaseList.reduce(
      (sum, item) => sum + toSafeNumber(item.totalAmount),
      0
    );

    const productCostById = new Map(
      products.map((product) => [product._id, toSafeNumber(product.purchasePrice)])
    );

    const todayCogs = todaySalesList.reduce((sum, invoice) => {
      const invoiceCogs = (invoice.items || []).reduce((lineSum, line) => {
        const productId = line?.productId?._id || line?.productId;
        const purchasePrice = productCostById.get(productId) || 0;
        return lineSum + purchasePrice * toSafeNumber(line.quantity);
      }, 0);
      return sum + invoiceCogs;
    }, 0);

    const todayReturnCogs = todayReturnsList.reduce((sum, ret) => {
      const cogs = (ret.items || []).reduce((lineSum, line) => {
        const productId = line?.productId?._id || line?.productId;
        const purchasePrice = productCostById.get(productId) || 0;
        return lineSum + purchasePrice * toSafeNumber(line.quantity);
      }, 0);

      return sum + cogs;
    }, 0);

    const todayClaimLossExposure = claims
      .filter((claim) => sameDay(new Date(claim.createdAt), now) && contributesClaimLoss(claim))
      .reduce((sum, claim) => sum + claimLossAmount(claim), 0);

    const lowStockCount = products.filter(
      (product) => toSafeNumber(product.stockQuantity) <= toSafeNumber(product.minStockLevel)
    ).length;
    const outOfStockCount = products.filter((product) => toSafeNumber(product.stockQuantity) === 0).length;

    const totalReceivable = customers.reduce((sum, customer) => sum + toSafeNumber(customer.balance), 0);
    const totalPayable = suppliers.reduce((sum, supplier) => sum + toSafeNumber(supplier.balance), 0);
    const stockValue = products.reduce(
      (sum, product) =>
        sum + toSafeNumber(product.stockQuantity) * toSafeNumber(product.purchasePrice),
      0
    );

    return {
      todaySales,
      todayProfit: todaySales - (todayCogs - todayReturnCogs) - todayClaimLossExposure,
      todayCashflowAfterPurchases: todaySales - todayPurchaseCost - todayClaimLossExposure,
      todayInvoices: todaySalesList.length,
      todayReturnsCount: todayReturnsList.length,
      todayReturnsAmount,
      todayPurchases: todayPurchaseList.length,
      totalProducts: products.length,
      lowStockProducts: lowStockCount,
      outOfStockProducts: outOfStockCount,
      totalReceivable,
      totalPayable,
      todayPurchaseCost,
      totalCustomers: customers.length,
      totalSuppliers: suppliers.length,
      inventoryValue: stockValue,
      pendingClaims: claims.filter((row) => row.status === "pending").length,
      acceptedClaims: claims.filter((row) => row.status === "accepted").length,
      rejectedClaims: claims.filter((row) => row.status === "rejected").length,
      claimLossValue: claims
        .filter((row) => contributesClaimLoss(row))
        .reduce((sum, row) => sum + claimLossAmount(row), 0),
      todayClaimLossExposure,
    };
  }, [sales, returnsData, claims, purchases, products, customers, suppliers]);

  const recentInvoices = useMemo(
    () => [...sales].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
    [sales]
  );

  const recentPurchases = useMemo(
    () => [...purchases].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 6),
    [purchases]
  );

  const cards = [
    { label: "Today Sales", value: currency.format(metrics.todaySales), tone: "teal" },
    { label: "Today Profit (After Claims)", value: currency.format(metrics.todayProfit), tone: "green" },
    { label: "Today Purchase Cost", value: currency.format(metrics.todayPurchaseCost), tone: "orange" },
    { label: "Invoices Today", value: metrics.todayInvoices, tone: "blue" },
    {
      label: `Returns Today (${metrics.todayReturnsCount})`,
      value: currency.format(metrics.todayReturnsAmount),
      tone: "orange",
    },
    { label: "Claim Loss Exposure", value: currency.format(metrics.claimLossValue), tone: "orange" },
    { label: "Inventory Value", value: currency.format(metrics.inventoryValue), tone: "blue" },
    {
      label: "Today Cashflow (After Purchases)",
      value: currency.format(metrics.todayCashflowAfterPurchases),
      tone: "teal",
    },
  ];

  return (
    <Layout title="Dashboard">
      <div className="dashboard-wrap">
        {loading ? <p>Loading dashboard...</p> : null}
        {error ? <p key={errorKey} className="error-text">{error}</p> : null}

        {!loading && !error ? (
          <>
            <section className="executive-banner">
              <div>
                <h2>Hafiz G Mobile Traders</h2>
                <p className="banner-subcopy">
                  Fast billing, accurate stock tracking, and clear cash visibility for smarter daily decisions.
                </p>
              </div>
              <div className="banner-meters">
                <div>
                  <span>Receivable</span>
                  <strong>{currency.format(metrics.totalReceivable)}</strong>
                </div>
                <div>
                  <span>Payable</span>
                  <strong>{currency.format(metrics.totalPayable)}</strong>
                </div>
                <div>
                  <span>Purchases Today</span>
                  <strong>{metrics.todayPurchases}</strong>
                </div>
              </div>
            </section>

            <div className="kpi-grid">
              {cards.map((card) => (
                <article key={card.label} className={`kpi-card ${card.tone}`}>
                  <p className="kpi-label">{card.label}</p>
                  <h3 className="kpi-value">{card.value}</h3>
                </article>
              ))}
            </div>

            <div className="status-grid">
              <article className="status-card warning">
                <p>Low Stock Alerts</p>
                <h3>{metrics.lowStockProducts}</h3>
                <small>Products at or below minimum threshold</small>
              </article>
              <article className="status-card danger">
                <p>Out of Stock</p>
                <h3>{metrics.outOfStockProducts}</h3>
                <small>Products currently unavailable for sale</small>
              </article>
              <article className="status-card neutral">
                <p>Catalog Coverage</p>
                <h3>{metrics.totalProducts}</h3>
                <small>
                  {metrics.totalCustomers} customers and {metrics.totalSuppliers} suppliers
                </small>
              </article>
              <article className="status-card warning">
                <p>Claims Monitor</p>
                <h3>
                  {metrics.pendingClaims} / {metrics.acceptedClaims} / {metrics.rejectedClaims}
                </h3>
                <small>Pending / Accepted / Rejected claims</small>
              </article>
            </div>

            <div className="table-grid">
              <section className="panel">
                <h3>Recent Invoices</h3>
                <div className="products-table-scroll">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Invoice</th>
                        <th>Date</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentInvoices.length === 0 ? (
                        <tr>
                          <td colSpan="3">No invoices yet</td>
                        </tr>
                      ) : (
                        recentInvoices.map((invoice) => (
                          <tr key={invoice._id}>
                            <td>{invoice.invoiceNumber}</td>
                            <td>{new Date(invoice.date).toLocaleDateString()}</td>
                            <td>{currency.format(toSafeNumber(invoice.grandTotal))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>

              <section className="panel">
                <h3>Recent Purchases</h3>
                <div className="products-table-scroll">
                  <table className="dash-table">
                    <thead>
                      <tr>
                        <th>Purchase</th>
                        <th>Date</th>
                        <th>Total</th>
                      </tr>
                    </thead>
                    <tbody>
                      {recentPurchases.length === 0 ? (
                        <tr>
                          <td colSpan="3">No purchases yet</td>
                        </tr>
                      ) : (
                        recentPurchases.map((purchase) => (
                          <tr key={purchase._id}>
                            <td>{purchase.purchaseInvoiceNumber}</td>
                            <td>{new Date(purchase.date).toLocaleDateString()}</td>
                            <td>{currency.format(toSafeNumber(purchase.totalAmount))}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </Layout>
  );
};

export default DashboardPage;
