import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import client from "../api/client";

const SETTINGS_STORAGE_KEY = "hafizg_settings_v1";

const currency = new Intl.NumberFormat("en-PK", {
  style: "currency",
  currency: "PKR",
  maximumFractionDigits: 0,
});

const dateOnly = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
});

const timeOnly = new Intl.DateTimeFormat("en-PK", {
  timeStyle: "short",
});

const fallbackStore = {
  storeName: "Hafiz G Mobile",
  phone: "",
  address: "",
};

const readStoreProfile = () => {
  try {
    const raw = localStorage.getItem(SETTINGS_STORAGE_KEY);
    if (!raw) {
      return fallbackStore;
    }

    const parsed = JSON.parse(raw);
    const general = parsed?.general || {};

    return {
      storeName: String(general.storeName || fallbackStore.storeName),
      phone: String(general.phone || ""),
      address: String(general.address || ""),
    };
  } catch (_error) {
    return fallbackStore;
  }
};

const PurchasePrint = () => {
  const { invoiceId } = useParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [invoice, setInvoice] = useState(null);

  const storeProfile = useMemo(() => readStoreProfile(), []);

  useEffect(() => {
    const loadInvoice = async () => {
      if (!invoiceId) {
        setError("Invoice id is missing");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");
        const response = await client.get(`/purchases/${invoiceId}`);
        setInvoice(response.data?.data || null);
      } catch (fetchError) {
        setError(fetchError.response?.data?.message || "Failed to load purchase invoice");
      } finally {
        setLoading(false);
      }
    };

    loadInvoice();
  }, [invoiceId]);

  useEffect(() => {
    if (!loading && invoice && !error) {
      window.print();
    }
  }, [loading, invoice, error]);

  const dueAmount = Math.max(0, Number(invoice?.totalAmount || 0) - Number(invoice?.paidAmount || 0));
  const billGeneratedAt = invoice?.createdAt || invoice?.updatedAt || Date.now();
  const shopHeading = "Hafiz G Mobile";

  return (
    <div className="invoice-print-page">
      {loading ? <p className="print-screen-note">Loading purchase invoice...</p> : null}
      {!loading && error ? <p className="print-screen-note print-screen-error">{error}</p> : null}

      {!loading && !error && invoice ? (
        <>
          <div className="print-screen-toolbar">
            <Link to="/purchases" className="ghost-btn print-screen-link">
              Back to Purchases
            </Link>
            <button type="button" className="primary-btn" onClick={() => window.print()}>
              Print Purchase
            </button>
          </div>

          <div id="print-area" className="thermal-receipt purchase-print-sheet">
            <header className="receipt-head">
              <h1>{shopHeading}</h1>
              {storeProfile.phone ? <p>{storeProfile.phone}</p> : null}
              {storeProfile.address ? <p>{storeProfile.address}</p> : null}
            </header>

            <section className="receipt-meta">
              <p>
                <strong>Invoice:</strong> {invoice.purchaseInvoiceNumber || "-"}
              </p>
              <p>
                <strong>Date:</strong> {dateOnly.format(new Date(invoice.date || billGeneratedAt))}
              </p>
              <p>
                <strong>Bill Time:</strong> {timeOnly.format(new Date(billGeneratedAt))}
              </p>
              {invoice.supplierId?.name ? (
                <p>
                  <strong>Supplier:</strong> {invoice.supplierId.name}
                </p>
              ) : null}
            </section>

            <table className="receipt-items">
              <thead>
                <tr>
                  <th>Item</th>
                  <th>Qty</th>
                  <th>Unit</th>
                  <th>Subtotal</th>
                </tr>
              </thead>
              <tbody>
                {(invoice.items || []).map((item, index) => (
                  <tr key={`${invoice._id}-print-item-${index}`}>
                    <td>{item.productId?.name || "-"}</td>
                    <td>{item.quantity}</td>
                    <td>{currency.format(Number(item.unitPrice || 0))}</td>
                    <td>{currency.format(Number(item.subtotal || 0))}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            <section className="receipt-totals">
              <p>
                <span>Total Amount</span>
                <strong>{currency.format(Number(invoice.totalAmount || 0))}</strong>
              </p>
              <p>
                <span>Paid</span>
                <strong>{currency.format(Number(invoice.paidAmount || 0))}</strong>
              </p>
              <p>
                <span>Status</span>
                <strong>{String(invoice.paymentStatus || "unpaid").toUpperCase()}</strong>
              </p>
              <p className="receipt-grand-total">
                <span>Due</span>
                <strong>{currency.format(dueAmount)}</strong>
              </p>
            </section>

            <footer className="receipt-footer">Thank you for your business</footer>
          </div>
        </>
      ) : null}
    </div>
  );
};

export default PurchasePrint;
