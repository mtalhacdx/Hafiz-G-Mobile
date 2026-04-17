import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Navigate, useLocation } from "react-router-dom";
import { login } from "../features/auth/authSlice";
import brandLogo from "../assets/LogoNavy.svg";

const LoginPage = () => {
  const dispatch = useDispatch();
  const location = useLocation();
  const { token, loading, error } = useSelector((state) => state.auth);
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [accountNotice, setAccountNotice] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const fromQuery = params.get("status") === "deactivated";
    const fromStorage = localStorage.getItem("auth_notice") || "";

    if (fromQuery || fromStorage) {
      setAccountNotice(
        fromStorage || "Your account has been deactivated by owner admin. Please contact owner for access."
      );
      localStorage.removeItem("auth_notice");
    }
  }, [location.search]);

  if (token) {
    return <Navigate to="/" replace />;
  }

  const onSubmit = (event) => {
    event.preventDefault();
    dispatch(login({ identifier, password }));
  };

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: "1rem" }}>
      <form
        onSubmit={onSubmit}
        style={{
          width: "min(420px, 100%)",
          background: "#fffaf2",
          padding: "1.2rem",
          borderRadius: "0.8rem",
          boxShadow: "0 10px 28px rgba(0,0,0,0.12)",
        }}
      >
        <img
          src={brandLogo}
          alt="HafizG Mobile"
          style={{
            display: "block",
            width: "min(170px, 52%)",
            height: "auto",
            margin: "0 auto 0.65rem",
          }}
        />
        <h1 style={{ marginTop: "0.45rem", marginBottom: "0.7rem", color: "#163a66", textAlign: "center" }}>
          Admin Login
        </h1>

        <label htmlFor="identifier">Username or Email</label>
        <input
          id="identifier"
          type="text"
          value={identifier}
          onChange={(event) => setIdentifier(event.target.value)}
          required
          style={{ width: "100%", marginTop: "0.3rem", marginBottom: "0.8rem", padding: "0.6rem" }}
        />

        <label htmlFor="password">Password</label>
        <div style={{ position: "relative", marginTop: "0.3rem", marginBottom: "0.8rem" }}>
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
            style={{ width: "100%", padding: "0.6rem 2.5rem 0.6rem 0.6rem" }}
          />
          <button
            type="button"
            aria-label={showPassword ? "Hide password" : "Show password"}
            onClick={() => setShowPassword((prev) => !prev)}
            style={{
              position: "absolute",
              right: "0.55rem",
              top: "50%",
              transform: "translateY(-50%)",
              border: "none",
              background: "transparent",
              cursor: "pointer",
              fontSize: "1rem",
              color: "#4f4a43",
              padding: 0,
              lineHeight: 1,
            }}
          >
            {showPassword ? "◉" : "◌"}
          </button>
        </div>

        {accountNotice ? <p style={{ color: "#92400e", fontWeight: 600 }}>{accountNotice}</p> : null}
        {error ? <p style={{ color: "#a32020" }}>{error}</p> : null}

        <button
          type="submit"
          disabled={loading}
          style={{
            width: "100%",
            padding: "0.7rem",
            border: "none",
            borderRadius: "0.5rem",
            background: "#163a66",
            color: "#fff",
          }}
        >
          {loading ? "Signing in..." : "Sign in"}
        </button>
      </form>
    </div>
  );
};

export default LoginPage;
