import { useEffect, useState } from "react";
import { useDispatch } from "react-redux";
import { useLocation, useNavigate } from "react-router-dom";
import Layout from "../components/Layout";
import { useSmartPopup } from "../components/SmartPopupProvider";
import client from "../api/client";
import { logout } from "../features/auth/authSlice";
import useToastMessage from "../hooks/useToastMessage";

const STORAGE_KEY = "hafizg_settings_v1";
const paymentOptions = ["cash", "bank", "card", "upi", "other"];
const OPERATIONAL_RESET_TEXT = "RESET OPERATIONAL DATA";
const MASTER_RESET_TEXT = "RESET ALL DATA";

const dateTime = new Intl.DateTimeFormat("en-PK", {
  dateStyle: "medium",
  timeStyle: "short",
});

const getPasswordStrength = (password) => {
  const value = String(password || "");
  if (!value) {
    return { score: 0, label: "Empty", color: "#9ca3af" };
  }

  const hasUpper = /[A-Z]/.test(value);
  const hasLower = /[a-z]/.test(value);
  const hasNumber = /[0-9]/.test(value);
  const hasSpecial = /[^A-Za-z0-9]/.test(value);
  const groups = [hasUpper, hasLower, hasNumber, hasSpecial].filter(Boolean).length;

  if (hasUpper && hasLower && hasNumber && hasSpecial) {
    return { score: 3, label: "Strong", color: "#2e7d4f" };
  }

  if (groups >= 2) {
    return { score: 2, label: "Medium", color: "#c1841f" };
  }

  return { score: 1, label: "Weak", color: "#c2543f" };
};

const emptySettings = {
  general: {
    storeName: "HafizG Mobile",
    phone: "",
    address: "",
  },
  billing: {
    defaultPaymentMethod: "cash",
    lowStockThreshold: "5",
  },
  security: {
    autoLogoutMinutes: "120",
  },
};

const safeParse = (value) => {
  try {
    return JSON.parse(value);
  } catch (_error) {
    return null;
  }
};

const SettingsPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const popup = useSmartPopup();

  const [saving, setSaving] = useState(false);
  const [changingPassword, setChangingPassword] = useState(false);
  const [resettingOperationalData, setResettingOperationalData] = useState(false);
  const [wipingMasterData, setWipingMasterData] = useState(false);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [creatingManager, setCreatingManager] = useState(false);
  const [updatingUserId, setUpdatingUserId] = useState("");
  const { notice, noticeKey, error, errorKey, setNotice, setError } = useToastMessage();
  const [managerInlineError, setManagerInlineError] = useState("");
  const [dangerInlineError, setDangerInlineError] = useState("");
  const [securityInlineError, setSecurityInlineError] = useState("");
  const [operationalConfirmInput, setOperationalConfirmInput] = useState("");
  const [masterConfirmInput, setMasterConfirmInput] = useState("");
  const [managerResetTargetId, setManagerResetTargetId] = useState("");
  const [managerResetPassword, setManagerResetPassword] = useState("");
  const [passwordForm, setPasswordForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [teamUsers, setTeamUsers] = useState([]);
  const [managerForm, setManagerForm] = useState({
    name: "",
    username: "",
    password: "",
  });
  const managerPasswordStrength = getPasswordStrength(managerForm.password);
  const adminPasswordStrength = getPasswordStrength(passwordForm.newPassword);
  const passwordsMatch =
    Boolean(passwordForm.confirmPassword) && passwordForm.newPassword === passwordForm.confirmPassword;

  const [settings, setSettings] = useState(() => {
    const saved = safeParse(localStorage.getItem(STORAGE_KEY));

    if (!saved) {
      return emptySettings;
    }

    return {
      general: { ...emptySettings.general, ...(saved.general || {}) },
      billing: { ...emptySettings.billing, ...(saved.billing || {}) },
      security: { ...emptySettings.security, ...(saved.security || {}) },
    };
  });

  const [summary, setSummary] = useState({
    products: 0,
    lowStock: 0,
    categories: 0,
    brands: 0,
    customers: 0,
    suppliers: 0,
    salesInvoices: 0,
    purchases: 0,
    returns: 0,
    claims: 0,
    duePayments: 0,
  });

  const [snapshot, setSnapshot] = useState({
    products: [],
    categories: [],
    brands: [],
    customers: [],
    suppliers: [],
    sales: [],
    purchases: [],
    returns: [],
    claims: [],
    duePayments: [],
  });

  const [lastBackupAt, setLastBackupAt] = useState(() => localStorage.getItem("hafizg_last_backup_at") || "");

  const loadSummary = async () => {
    try {
      setError("");

      const [
        productsRes,
        categoriesRes,
        brandsRes,
        customersRes,
        suppliersRes,
        salesRes,
        purchasesRes,
        returnsRes,
        claimsRes,
        duePaymentsRes,
      ] = await Promise.all([
        client.get("/products"),
        client.get("/categories", { params: { includeInactive: true } }),
        client.get("/brands", { params: { includeInactive: true } }),
        client.get("/customers", { params: { includeInactive: true } }),
        client.get("/suppliers", { params: { includeInactive: true } }),
        client.get("/sales"),
        client.get("/purchases"),
        client.get("/returns"),
        client.get("/claims"),
        client.get("/due-payments"),
      ]);

      const products = productsRes.data?.data || [];
      const categories = categoriesRes.data?.data || [];
      const brands = brandsRes.data?.data || [];
      const customers = customersRes.data?.data || [];
      const suppliers = suppliersRes.data?.data || [];
      const sales = salesRes.data?.data || [];
      const purchases = purchasesRes.data?.data || [];
      const returns = returnsRes.data?.data || [];
      const claims = claimsRes.data?.data || [];
      const duePayments = duePaymentsRes.data?.data || [];

      setSnapshot({
        products,
        categories,
        brands,
        customers,
        suppliers,
        sales,
        purchases,
        returns,
        claims,
        duePayments,
      });

      const threshold = Math.max(0, Number(settings.billing.lowStockThreshold || 0));

      setSummary({
        products: products.length,
        lowStock: products.filter((item) => Number(item.stockQuantity || 0) <= threshold).length,
        categories: categories.length,
        brands: brands.length,
        customers: customers.length,
        suppliers: suppliers.length,
        salesInvoices: sales.length,
        purchases: purchases.length,
        returns: returns.length,
        claims: claims.length,
        duePayments: duePayments.length,
      });
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load settings summary");
    }
  };

  useEffect(() => {
    loadSummary();
    loadManagerUsers();
  }, []);

  const loadManagerUsers = async () => {
    try {
      setLoadingUsers(true);
      const response = await client.get("/settings/users");
      setTeamUsers(response.data?.data || []);
    } catch (fetchError) {
      setError(fetchError.response?.data?.message || "Failed to load manager users");
    } finally {
      setLoadingUsers(false);
    }
  };

  useEffect(() => {
    if (!location.hash) {
      return;
    }

    const sectionId = location.hash === "#security" ? "settings-security-section" : "settings-profile-section";
    const target = document.getElementById(sectionId);

    if (target) {
      target.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [location.hash]);

  const updateSettings = (section, key, value) => {
    setSettings((prev) => ({
      ...prev,
      [section]: {
        ...prev[section],
        [key]: value,
      },
    }));
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      setError("");
      setNotice("");

      const threshold = Number(settings.billing.lowStockThreshold);
      if (!Number.isInteger(threshold) || threshold < 0) {
        setError("Low stock threshold must be a non-negative whole number");
        setNotice("");
        return;
      }

      await client.post("/settings/apply-low-stock-threshold", {
        threshold,
      });

      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
      setNotice("System updated successfully");

      await loadSummary();
    } catch (_saveError) {
      setError(_saveError.response?.data?.message || "Failed to save settings");
    } finally {
      setSaving(false);
    }
  };

  const resetSettings = async () => {
    const confirmed = await popup.confirm({
      title: "Reset Settings",
      message: "Reset settings to default values?",
      confirmText: "Reset",
    });

    if (!confirmed) {
      return;
    }

    setSettings(emptySettings);
    localStorage.removeItem(STORAGE_KEY);
    setNotice("Settings reset to defaults");
    setError("");
  };

  const changePassword = async () => {
    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setSecurityInlineError("Please fill all password fields");
      setNotice("");
      return;
    }

    if (newPassword.length < 8) {
      setSecurityInlineError("New password must be at least 8 characters");
      setNotice("");
      return;
    }

    if (!/[A-Z]/.test(newPassword) || !/[a-z]/.test(newPassword) || !/[0-9]/.test(newPassword)) {
      setSecurityInlineError("New password must include uppercase, lowercase, and a number");
      setNotice("");
      return;
    }

    if (newPassword !== confirmPassword) {
      setSecurityInlineError("New password and confirm password do not match");
      setNotice("");
      return;
    }

    try {
      setChangingPassword(true);
      setSecurityInlineError("");
      setNotice("");

      await client.post("/settings/change-password", {
        currentPassword,
        newPassword,
      });

      setPasswordForm({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
      setNotice("Password changed successfully");
    } catch (passwordError) {
      setSecurityInlineError(passwordError.response?.data?.message || "Failed to change password");
    } finally {
      setChangingPassword(false);
    }
  };

  const downloadBackupJson = () => {
    try {
      const payload = {
        exportedAt: new Date().toISOString(),
        summary,
        preferences: settings,
        data: snapshot,
      };

      const blob = new Blob([JSON.stringify(payload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      const stamp = new Date().toISOString().slice(0, 10);
      link.href = url;
      link.download = `hafizg-backup-${stamp}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      const backupAt = new Date().toISOString();
      localStorage.setItem("hafizg_last_backup_at", backupAt);
      setLastBackupAt(backupAt);
      setNotice("Backup downloaded");
      setError("");
    } catch (_backupError) {
      setError("Failed to create backup file");
    }
  };

  const signOut = async () => {
    const confirmed = await popup.confirm({
      title: "Sign Out",
      message: "Sign out from this admin session?",
      confirmText: "Sign Out",
    });

    if (!confirmed) {
      return;
    }

    dispatch(logout());
    navigate("/login", { replace: true });
  };

  const createManager = async (event) => {
    event.preventDefault();

    const name = managerForm.name.trim();
    const username = managerForm.username.trim().toLowerCase();
    const password = managerForm.password.trim();

    if (!name || !username || !password) {
      setManagerInlineError("Please provide stock manager name, username and password");
      setNotice("");
      return;
    }

    if (!password) {
      setManagerInlineError("Please provide a password");
      setNotice("");
      return;
    }

    try {
      setCreatingManager(true);
      setManagerInlineError("");
      setNotice("");

      await client.post("/settings/users", { name, username, password });
      setManagerForm({ name: "", username: "", password: "" });
      setNotice("Stock manager account created");
      await loadManagerUsers();
    } catch (createError) {
      setManagerInlineError(createError.response?.data?.message || "Failed to create stock manager account");
    } finally {
      setCreatingManager(false);
    }
  };

  const resetManagerPassword = async (user) => {
    if (managerResetTargetId !== user.id) {
      setManagerResetTargetId(user.id);
      setManagerResetPassword("");
      setManagerInlineError("");
      return;
    }

    const password = String(managerResetPassword).trim();
    if (!password) {
      setManagerInlineError("Please enter a password");
      setNotice("");
      return;
    }

    try {
      setUpdatingUserId(user.id);
      setManagerInlineError("");
      setNotice("");
      await client.patch(`/settings/users/${user.id}/reset-password`, { newPassword: password });
      setNotice("Manager password reset successfully");
      setManagerResetTargetId("");
      setManagerResetPassword("");
    } catch (actionError) {
      setManagerInlineError(actionError.response?.data?.message || "Failed to reset manager password");
    } finally {
      setUpdatingUserId("");
    }
  };

  const deleteManager = async (user) => {
    const confirmed = await popup.confirm({
      title: "Delete Stock Manager",
      message: `Delete ${user.name || user.username} permanently?`,
      confirmText: "Delete",
    });

    if (!confirmed) {
      return;
    }

    try {
      setUpdatingUserId(user.id);
      setManagerInlineError("");
      setNotice("");
      await client.delete(`/settings/users/${user.id}`);
      setNotice("Stock manager deleted successfully");
      await loadManagerUsers();
    } catch (actionError) {
      setManagerInlineError(actionError.response?.data?.message || "Failed to delete stock manager");
    } finally {
      setUpdatingUserId("");
    }
  };

  const toggleManagerStatus = async (user) => {
    const nextStatus = !user.isActive;
    const confirmed = await popup.confirm({
      title: nextStatus ? "Activate Manager" : "Deactivate Manager",
      message: nextStatus
        ? `Activate ${user.username} account?`
        : `Deactivate ${user.username} account? They will not be able to login.`,
      confirmText: nextStatus ? "Activate" : "Deactivate",
    });

    if (!confirmed) {
      return;
    }

    try {
      setUpdatingUserId(user.id);
      setManagerInlineError("");
      setNotice("");
      await client.patch(`/settings/users/${user.id}/status`, { isActive: nextStatus });
      setNotice(nextStatus ? "Manager activated" : "Manager deactivated");
      await loadManagerUsers();
    } catch (actionError) {
      setManagerInlineError(actionError.response?.data?.message || "Failed to update manager status");
    } finally {
      setUpdatingUserId("");
    }
  };

  const resetOperationalData = async () => {
    if (operationalConfirmInput.trim().toUpperCase() !== OPERATIONAL_RESET_TEXT) {
      setDangerInlineError(`Type '${OPERATIONAL_RESET_TEXT}' to continue operational reset`);
      setNotice("");
      return;
    }

    try {
      setResettingOperationalData(true);
      setDangerInlineError("");
      setNotice("");

      await client.post("/settings/reset-system-data", {
        confirmation: OPERATIONAL_RESET_TEXT,
      });

      await loadSummary();
      setNotice("Operational history has been reset successfully");
      setOperationalConfirmInput("");
    } catch (wipeError) {
      setDangerInlineError(wipeError.response?.data?.message || "Failed to reset operational history");
    } finally {
      setResettingOperationalData(false);
    }
  };

  const eraseMasterData = async () => {
    if (masterConfirmInput.trim().toUpperCase() !== MASTER_RESET_TEXT) {
      setDangerInlineError(`Type '${MASTER_RESET_TEXT}' to continue master data erase`);
      setNotice("");
      return;
    }

    try {
      setWipingMasterData(true);
      setDangerInlineError("");
      setNotice("");

      await client.post("/settings/reset-master-data", {
        confirmation: MASTER_RESET_TEXT,
      });

      localStorage.removeItem("hafizg_last_backup_at");
      localStorage.removeItem(STORAGE_KEY);

      setLastBackupAt("");
      setSettings(emptySettings);

      await loadSummary();
      setNotice("All software data has been removed successfully");
      setMasterConfirmInput("");
    } catch (wipeError) {
      setDangerInlineError(wipeError.response?.data?.message || "Failed to remove master data");
    } finally {
      setWipingMasterData(false);
    }
  };

  return (
    <Layout title="Settings">
      <div className="settings-wrap">
        <section className="sales-hero">
          <div>
            <p className="hero-eyebrow">Clean Setup</p>
            <h2>Simple store settings that apply directly to daily work</h2>
          </div>
          <div className="settings-hero-actions">
            <button type="button" className="ghost-btn" onClick={resetSettings}>
              Reset
            </button>
            <button type="button" className="primary-btn" onClick={saveSettings} disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </section>

        {notice ? <p key={noticeKey} className="success-text">{notice}</p> : null}
        {error ? <p key={errorKey} className="error-text">{error}</p> : null}

        <section className="editor-card settings-section-target" id="settings-profile-section">
          <div className="editor-head compact">
            <div>
              <p className="hero-eyebrow">Store Profile</p>
              <h3>Brand and Contact</h3>
            </div>
          </div>

          <div className="editor-form customer-form">
            <label>
              Store Name
              <input
                value={settings.general.storeName}
                onChange={(event) => updateSettings("general", "storeName", event.target.value)}
              />
            </label>

            <label>
              Phone
              <input
                value={settings.general.phone}
                onChange={(event) => updateSettings("general", "phone", event.target.value)}
              />
            </label>

            <label className="customer-form-full">
              Address
              <textarea
                rows={3}
                value={settings.general.address}
                onChange={(event) => updateSettings("general", "address", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="editor-card settings-section-target" id="settings-security-section">
          <div className="editor-head compact">
            <div>
              <p className="hero-eyebrow">Billing Defaults</p>
              <h3>Applied in Sales Invoice Builder</h3>
            </div>
          </div>

          <div className="editor-form customer-form">
            <label>
              Default Payment Method
              <select
                value={settings.billing.defaultPaymentMethod}
                onChange={(event) => updateSettings("billing", "defaultPaymentMethod", event.target.value)}
              >
                {paymentOptions.map((option) => (
                  <option key={option} value={option}>
                    {option.toUpperCase()}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Low Stock Threshold
              <input
                type="number"
                min="0"
                value={settings.billing.lowStockThreshold}
                onChange={(event) => updateSettings("billing", "lowStockThreshold", event.target.value)}
              />
            </label>
          </div>
        </section>

        <section className="editor-card">
          <div className="editor-head compact">
            <div>
              <p className="hero-eyebrow">System Tools</p>
              <h3>Backup and Safety</h3>
            </div>
          </div>

          <div className="settings-backup-panel">
            <p>
              Last backup: {lastBackupAt ? dateTime.format(new Date(lastBackupAt)) : "Not created yet"}
            </p>

            <div className="editor-actions">
              <button type="button" className="primary-btn" onClick={downloadBackupJson}>
                Download Backup
              </button>
              <button type="button" className="ghost-btn" onClick={loadSummary}>
                Refresh Data
              </button>
              <button type="button" className="ghost-btn" onClick={signOut}>
                Sign Out
              </button>
            </div>

            <div className="settings-danger-zone">
              <div className="danger-zone-head">
                <h4>Danger Zone</h4>
                <span className="danger-zone-badge">High Impact</span>
              </div>
              <p className="danger-zone-subcopy">
                These actions permanently affect core records. Confirm carefully before continuing.
              </p>

              <div className="danger-actions-grid">
                <div className="danger-action-card">
                  <p className="danger-action-title">Operational Reset</p>
                  <p className="danger-action-copy">Clears sales, purchases, returns, claims, dues, and report history only.</p>
                  <p className="danger-action-hint">Confirmation text required:</p>
                  <input
                    type="text"
                    value={operationalConfirmInput}
                    onChange={(event) => {
                      setDangerInlineError("");
                      setOperationalConfirmInput(event.target.value);
                    }}
                    placeholder={`Type ${OPERATIONAL_RESET_TEXT}`}
                  />
                  <button
                    type="button"
                    className="danger-btn danger-btn-soft"
                    onClick={resetOperationalData}
                    disabled={resettingOperationalData || wipingMasterData}
                  >
                    {resettingOperationalData ? "Resetting..." : "Reset Sales, Purchases, Claims & Reports"}
                  </button>
                </div>

                <div className="danger-action-card">
                  <p className="danger-action-title">Master Data Erase</p>
                  <p className="danger-action-copy">Deletes products, customers, brands, suppliers, categories, and all linked history.</p>
                  <p className="danger-action-hint">Confirmation text required:</p>
                  <input
                    type="text"
                    value={masterConfirmInput}
                    onChange={(event) => {
                      setDangerInlineError("");
                      setMasterConfirmInput(event.target.value);
                    }}
                    placeholder={`Type ${MASTER_RESET_TEXT}`}
                  />
                  <button
                    type="button"
                    className="danger-btn danger-btn-hard"
                    onClick={eraseMasterData}
                    disabled={wipingMasterData || resettingOperationalData}
                  >
                    {wipingMasterData ? "Removing Data..." : "Erase Master Data"}
                  </button>
                </div>
              </div>
              {dangerInlineError ? <p className="sales-modal-error">{dangerInlineError}</p> : null}
            </div>
          </div>
        </section>

        <section className="editor-card">
          <div className="editor-head compact">
            <div>
              <p className="hero-eyebrow">Security</p>
              <h3>Session and Password Protection</h3>
            </div>
          </div>

          <p className="settings-security-note">
            Keep your account secure with a strong password. Use at least 8 characters and a mix of uppercase,
            lowercase, and numbers.
          </p>

          <div className="editor-form customer-form">
            <label>
              Auto Logout After Inactivity (Minutes)
              <input
                type="number"
                min="5"
                max="480"
                value={settings.security.autoLogoutMinutes}
                onChange={(event) => {
                  setSecurityInlineError("");
                  updateSettings("security", "autoLogoutMinutes", event.target.value);
                }}
              />
            </label>

            <label>
              Current Password
              <div className="password-input-wrap">
                <input
                  type={showCurrentPassword ? "text" : "password"}
                  value={passwordForm.currentPassword}
                  onChange={(event) => {
                    setSecurityInlineError("");
                    setPasswordForm((prev) => ({ ...prev, currentPassword: event.target.value }));
                  }}
                />
                <button
                  type="button"
                  aria-label={showCurrentPassword ? "Hide current password" : "Show current password"}
                  onClick={() => setShowCurrentPassword((prev) => !prev)}
                  className="password-visibility-btn"
                >
                  {showCurrentPassword ? "◉" : "◌"}
                </button>
              </div>
            </label>

            <label>
              New Password
              <div className="password-input-wrap">
                <input
                  type={showNewPassword ? "text" : "password"}
                  value={passwordForm.newPassword}
                  onChange={(event) => {
                    setSecurityInlineError("");
                    setPasswordForm((prev) => ({ ...prev, newPassword: event.target.value }));
                  }}
                />
                <button
                  type="button"
                  aria-label={showNewPassword ? "Hide new password" : "Show new password"}
                  onClick={() => setShowNewPassword((prev) => !prev)}
                  className="password-visibility-btn"
                >
                  {showNewPassword ? "◉" : "◌"}
                </button>
              </div>
            </label>

            <label>
              Confirm New Password
              <div className="password-input-wrap">
                <input
                  type={showConfirmPassword ? "text" : "password"}
                  value={passwordForm.confirmPassword}
                  onChange={(event) => {
                    setSecurityInlineError("");
                    setPasswordForm((prev) => ({ ...prev, confirmPassword: event.target.value }));
                  }}
                />
                <button
                  type="button"
                  aria-label={showConfirmPassword ? "Hide confirm password" : "Show confirm password"}
                  onClick={() => setShowConfirmPassword((prev) => !prev)}
                  className="password-visibility-btn"
                >
                  {showConfirmPassword ? "◉" : "◌"}
                </button>
              </div>
            </label>

            <div className="customer-form-full password-health-row">
              <p style={{ margin: 0, color: adminPasswordStrength.color }}>
                Password Strength: {adminPasswordStrength.label}
              </p>
              <div className="password-health-bar-track">
                <div
                  className="password-health-bar-fill"
                  style={{
                    width: `${(adminPasswordStrength.score / 3) * 100}%`,
                    background: adminPasswordStrength.color,
                  }}
                />
              </div>
              {passwordForm.confirmPassword ? (
                <small style={{ color: passwordsMatch ? "#1e7a48" : "#b42318", fontWeight: 600 }}>
                  {passwordsMatch ? "Passwords match" : "Passwords do not match"}
                </small>
              ) : null}
            </div>

            {securityInlineError ? <p className="sales-modal-error customer-form-full">{securityInlineError}</p> : null}

            <div className="editor-actions customer-form-full">
              <button
                type="button"
                className="primary-btn"
                onClick={changePassword}
                disabled={changingPassword}
              >
                {changingPassword ? "Updating..." : "Change Password"}
              </button>
            </div>
          </div>
        </section>

        <section className="editor-card">
          <div className="editor-head compact">
            <div>
              <p className="hero-eyebrow">Stock Manager</p>
              <h3>Stock Manager Accounts</h3>
            </div>
          </div>

          <form className="editor-form customer-form" onSubmit={createManager}>
            <label>
              Stock Manager Name
              <input
                type="text"
                value={managerForm.name}
                onChange={(event) => {
                  setManagerInlineError("");
                  setManagerForm((prev) => ({ ...prev, name: event.target.value }));
                }}
                placeholder="Muhammad Ali"
              />
            </label>

            <label>
              Username
              <input
                type="text"
                value={managerForm.username}
                onChange={(event) => {
                  setManagerInlineError("");
                  setManagerForm((prev) => ({ ...prev, username: event.target.value }));
                }}
                placeholder="stock.manager"
              />
            </label>

            <label>
              Password
              <input
                type="text"
                value={managerForm.password}
                onChange={(event) => {
                  setManagerInlineError("");
                  setManagerForm((prev) => ({ ...prev, password: event.target.value }));
                }}
                placeholder="Enter password"
              />
              <small style={{ marginTop: "0.35rem", display: "block", color: managerPasswordStrength.color }}>
                Password Strength: {managerPasswordStrength.label}
              </small>
              <div
                style={{
                  marginTop: "0.3rem",
                  height: "6px",
                  borderRadius: "999px",
                  background: "#e7e2d8",
                  overflow: "hidden",
                }}
              >
                <div
                  style={{
                    width: `${(managerPasswordStrength.score / 3) * 100}%`,
                    height: "100%",
                    background: managerPasswordStrength.color,
                    transition: "width 0.25s ease",
                  }}
                />
              </div>
            </label>

            {managerInlineError ? <p className="sales-modal-error customer-form-full">{managerInlineError}</p> : null}

            <div className="editor-actions customer-form-full">
              <button type="submit" className="primary-btn" disabled={creatingManager}>
                {creatingManager ? "Adding..." : "Add Stock Manager"}
              </button>
            </div>
          </form>

          <div className="products-table-scroll">
            <table className="products-table">
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Username</th>
                  <th>Role</th>
                  <th>Status</th>
                  <th>Created</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingUsers ? (
                  <tr>
                    <td colSpan="6">Loading stock manager accounts...</td>
                  </tr>
                ) : null}

                {!loadingUsers && teamUsers.filter((user) => user.role === "small_manager").length === 0 ? (
                  <tr>
                    <td colSpan="6">No stock manager accounts added yet.</td>
                  </tr>
                ) : null}

                {!loadingUsers
                  ? teamUsers
                      .filter((user) => user.role === "small_manager")
                      .map((user) => (
                        <tr key={user.id}>
                          <td>{user.name || "-"}</td>
                          <td>{user.username || "-"}</td>
                          <td>Stock Manager</td>
                          <td>
                            <span className={`payment-pill ${user.isActive ? "paid" : "unpaid"}`}>
                              {user.isActive ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td>{user.createdAt ? dateTime.format(new Date(user.createdAt)) : "-"}</td>
                          <td className="table-actions">
                            <button
                              type="button"
                              disabled={updatingUserId === user.id}
                              onClick={() => resetManagerPassword(user)}
                            >
                              {managerResetTargetId === user.id ? "Save Password" : "Reset Password"}
                            </button>
                            <button
                              type="button"
                              disabled={updatingUserId === user.id}
                              onClick={() => toggleManagerStatus(user)}
                            >
                              {user.isActive ? "Deactivate" : "Activate"}
                            </button>
                            <button
                              type="button"
                              disabled={updatingUserId === user.id}
                              onClick={() => deleteManager(user)}
                            >
                              Delete
                            </button>
                          </td>
                        </tr>
                      ))
                  : null}

                {managerResetTargetId ? (
                  <tr>
                    <td colSpan="6">
                      <div className="editor-form customer-form" style={{ paddingTop: "0.5rem" }}>
                        <label className="customer-form-full">
                          New Password
                          <input
                            type="text"
                            value={managerResetPassword}
                            onChange={(event) => {
                              setManagerInlineError("");
                              setManagerResetPassword(event.target.value);
                            }}
                            placeholder="Enter new password"
                          />
                        </label>
                        <div className="editor-actions customer-form-full">
                          <button
                            type="button"
                            className="ghost-btn"
                            onClick={() => {
                              setManagerResetTargetId("");
                              setManagerResetPassword("");
                              setManagerInlineError("");
                            }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </section>
      </div>
    </Layout>
  );
};

export default SettingsPage;
