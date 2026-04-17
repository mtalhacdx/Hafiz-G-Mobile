import { useEffect, useRef, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useLocation, useNavigate } from "react-router-dom";
import client from "../api/client";
import { logout } from "../features/auth/authSlice";
import brandLogo from "../assets/Logo.svg";
import { useSmartPopup } from "./SmartPopupProvider";

const navItems = [
  { to: "/", label: "Dashboard", roles: ["admin", "small_manager"] },
  { to: "/products", label: "Products", roles: ["admin", "small_manager"] },
  { to: "/categories", label: "Categories", roles: ["admin"] },
  { to: "/brands", label: "Brands", roles: ["admin"] },
  { to: "/sales", label: "Sales / Billing", roles: ["admin", "small_manager"] },
  { to: "/purchases", label: "Purchases", roles: ["admin"] },
  { to: "/customers", label: "Customers", roles: ["admin", "small_manager"] },
  { to: "/suppliers", label: "Suppliers", roles: ["admin"] },
  { to: "/returns", label: "Returns", roles: ["admin", "small_manager"] },
  { to: "/claims", label: "Claims", roles: ["admin", "small_manager"] },
  { to: "/reports", label: "Reports", roles: ["admin"] },
];

const successToastPalettes = [
  {
    border: "#b8e2cc",
    bgTop: "rgba(243, 255, 250, 0.96)",
    bgBottom: "rgba(227, 247, 238, 0.96)",
    text: "#124c30",
    iconBg: "#d5efdf",
    iconText: "#0f5b34",
    progressStart: "#1f7a4f",
    progressEnd: "#69c293",
  },
  {
    border: "#bcdcf1",
    bgTop: "rgba(244, 251, 255, 0.96)",
    bgBottom: "rgba(230, 242, 251, 0.96)",
    text: "#163e63",
    iconBg: "#d8eaf8",
    iconText: "#1b4e79",
    progressStart: "#2b6ea5",
    progressEnd: "#74a8d2",
  },
  {
    border: "#e4d4b5",
    bgTop: "rgba(255, 251, 243, 0.96)",
    bgBottom: "rgba(248, 238, 221, 0.96)",
    text: "#5f4222",
    iconBg: "#f2e2c5",
    iconText: "#7a552b",
    progressStart: "#a26a2d",
    progressEnd: "#d49a5d",
  },
];

const errorToastPalettes = [
  {
    border: "#efc1c1",
    bgTop: "rgba(255, 248, 248, 0.96)",
    bgBottom: "rgba(255, 238, 238, 0.96)",
    text: "#7f1b1b",
    iconBg: "#f9d7d7",
    iconText: "#8e1c1c",
    progressStart: "#a32323",
    progressEnd: "#da6f6f",
  },
  {
    border: "#efccb6",
    bgTop: "rgba(255, 250, 246, 0.96)",
    bgBottom: "rgba(255, 241, 232, 0.96)",
    text: "#7a3216",
    iconBg: "#f8dbc9",
    iconText: "#8a3d1f",
    progressStart: "#b44a21",
    progressEnd: "#e08a62",
  },
  {
    border: "#ddc8ea",
    bgTop: "rgba(251, 246, 255, 0.96)",
    bgBottom: "rgba(241, 232, 250, 0.96)",
    text: "#5d2b7a",
    iconBg: "#ead9f4",
    iconText: "#663384",
    progressStart: "#7b3ea0",
    progressEnd: "#b77dd7",
  },
];

const hashText = (value) => {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
};

const applyToastPalette = (element) => {
  const message = String(element.textContent || "").trim();
  const isError = element.classList.contains("error-text");
  const palettes = isError ? errorToastPalettes : successToastPalettes;
  const palette = palettes[hashText(message || "message") % palettes.length];

  element.style.setProperty("--toast-border", palette.border);
  element.style.setProperty("--toast-bg-top", palette.bgTop);
  element.style.setProperty("--toast-bg-bottom", palette.bgBottom);
  element.style.setProperty("--toast-text", palette.text);
  element.style.setProperty("--toast-icon-bg", palette.iconBg);
  element.style.setProperty("--toast-icon-text", palette.iconText);
  element.style.setProperty("--toast-progress-start", palette.progressStart);
  element.style.setProperty("--toast-progress-end", palette.progressEnd);
};

const buildProfileFromSettings = (adminUser, role) => {
  if (role === "small_manager" && adminUser?.name?.trim()) {
    const accountName = adminUser.name.trim();
    const initials = accountName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("");

    return {
      name: accountName,
      subtitle: "Stock Manager",
      initials: initials || "SM",
    };
  }

  const raw = localStorage.getItem("hafizg_settings_v1");

  if (!raw) {
    return { name: "HafizG Mobile", subtitle: "Store Profile", initials: "HM" };
  }

  try {
    const parsed = JSON.parse(raw);
    const storeName = parsed?.general?.storeName?.trim();

    if (!storeName) {
      return { name: "HafizG Mobile", subtitle: "Store Profile", initials: "HM" };
    }

    const initials = storeName
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0].toUpperCase())
      .join("");

    return {
      name: storeName,
      subtitle: "Store Profile",
      initials: initials || "AU",
    };
  } catch (_error) {
    return { name: "HafizG Mobile", subtitle: "Store Profile", initials: "HM" };
  }
};

const Layout = ({ title, children }) => {
  const dispatch = useDispatch();
  const admin = useSelector((state) => state.auth.admin);
  const navigate = useNavigate();
  const location = useLocation();
  const popup = useSmartPopup();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const profileMenuRef = useRef(null);

  useEffect(() => {
    const raw = localStorage.getItem("hafizg_settings_v1");
    let autoLogoutMinutes = 120;

    if (raw) {
      try {
        const parsed = JSON.parse(raw);
        const configured = Number(parsed?.security?.autoLogoutMinutes || 120);

        if (Number.isFinite(configured) && configured > 0) {
          autoLogoutMinutes = configured;
        }
      } catch (_error) {
        autoLogoutMinutes = 120;
      }
    }

    const timeoutMs = Math.max(1, autoLogoutMinutes) * 60 * 1000;
    let timeoutId;

    const forceLogout = () => {
      dispatch(logout());
      navigate("/login", { replace: true });
    };

    const resetTimer = () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      timeoutId = window.setTimeout(forceLogout, timeoutMs);
    };

    const events = ["mousemove", "keydown", "click", "scroll", "touchstart"];
    events.forEach((eventName) => window.addEventListener(eventName, resetTimer, { passive: true }));
    resetTimer();

    return () => {
      if (timeoutId) {
        window.clearTimeout(timeoutId);
      }

      events.forEach((eventName) => window.removeEventListener(eventName, resetTimer));
    };
  }, [dispatch, navigate, location.pathname]);

  useEffect(() => {
    const paintToasts = () => {
      const toasts = document.querySelectorAll(".success-text, .error-text");
      toasts.forEach((toast) => applyToastPalette(toast));
    };

    paintToasts();

    const observer = new MutationObserver(() => {
      paintToasts();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
      characterData: true,
    });

    return () => observer.disconnect();
  }, [location.pathname]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      return;
    }

    let mounted = true;
    const verifySession = async () => {
      if (!mounted) {
        return;
      }

      try {
        await client.get("/auth/session");
      } catch (_error) {
        // Global axios interceptor handles deactivation logout + redirect.
      }
    };

    verifySession();
    const intervalId = window.setInterval(verifySession, 15000);

    return () => {
      mounted = false;
      window.clearInterval(intervalId);
    };
  }, [location.pathname]);

  useEffect(() => {
    const onDocumentClick = (event) => {
      if (!profileMenuRef.current) {
        return;
      }

      if (!profileMenuRef.current.contains(event.target)) {
        setProfileMenuOpen(false);
      }
    };

    const onEscape = (event) => {
      if (event.key === "Escape") {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", onDocumentClick);
    document.addEventListener("keydown", onEscape);

    return () => {
      document.removeEventListener("mousedown", onDocumentClick);
      document.removeEventListener("keydown", onEscape);
    };
  }, []);

  const role = admin?.role || "admin";
  const profile = buildProfileFromSettings(admin, role);
  const allowedNavItems = navItems.filter((item) => item.roles.includes(role));
  const roleLabel = role === "small_manager" ? "Stock Manager" : "Owner Admin";
  profile.subtitle = roleLabel;

  const onLogout = async () => {
    const confirmed = await popup.confirm({
      title: "Logout",
      message: "Logout from this session?",
      confirmText: "Logout",
    });
    if (!confirmed) {
      return;
    }

    dispatch(logout());
    navigate("/login", { replace: true });
  };

  const goToSettings = () => {
    setProfileMenuOpen(false);
    navigate("/settings#profile");
  };

  const showManagerAccessInfo = async () => {
    setProfileMenuOpen(false);
    await popup.confirm({
      title: "Small Manager Access",
      message:
        "You can manage sales, customers, returns and claims. Product stock is visible but catalog edit is restricted.",
      confirmText: "OK",
    });
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <img className="brand-logo" src={brandLogo} alt="HafizG Mobile" />
        <nav className="side-nav">
          {allowedNavItems.map((item) => {
            const active = location.pathname === item.to;
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`side-link ${active ? "active" : ""}`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className={`sidebar-profile ${profileMenuOpen ? "expanded" : ""}`} ref={profileMenuRef}>
          <button
            type="button"
            className="sidebar-profile-trigger"
            onClick={() => setProfileMenuOpen((prev) => !prev)}
            aria-expanded={profileMenuOpen}
            aria-label="Open profile actions"
          >
            <div className="sidebar-profile-meta">
              <div className="sidebar-avatar" aria-hidden="true">
                {profile.initials}
              </div>
              <div>
                <p className="sidebar-profile-name">{profile.name}</p>
                <p className="sidebar-profile-subtitle">{profile.subtitle}</p>
              </div>
            </div>
            <span className={`sidebar-chevron ${profileMenuOpen ? "open" : ""}`} aria-hidden="true">
              ▾
            </span>
          </button>

          <div className={`sidebar-profile-panel ${profileMenuOpen ? "open" : ""}`}>
            {role === "admin" ? (
              <button type="button" className="sidebar-action-btn" onClick={goToSettings}>
                System Settings
              </button>
            ) : (
              <button type="button" className="sidebar-action-btn" onClick={showManagerAccessInfo}>
                View My Access
              </button>
            )}
            <button type="button" className="sidebar-logout-btn" onClick={onLogout}>
              Logout
            </button>
          </div>
        </div>
      </aside>
      <main className="main-content">
        <h1 className="page-title">{title}</h1>
        <section>{children}</section>
      </main>
    </div>
  );
};

export default Layout;
