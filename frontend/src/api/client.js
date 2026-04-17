import axios from "axios";

const DEFAULT_API_PORT = "5000";
const browserHost = typeof window !== "undefined" ? window.location.hostname : "localhost";
const apiHost = import.meta.env.VITE_API_HOST || browserHost;
const apiPort = import.meta.env.VITE_API_PORT || DEFAULT_API_PORT;
const apiBaseUrl = import.meta.env.VITE_API_URL || `http://${apiHost}:${apiPort}/api`;

const client = axios.create({
  baseURL: apiBaseUrl,
});

const DEACTIVATED_NOTICE = "Your account has been deactivated by owner admin. Please contact owner for access.";

client.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

client.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error?.response?.status;
    const message = String(error?.response?.data?.message || "").toLowerCase();
    const isDeactivated = status === 403 && message.includes("deactivated");

    if (isDeactivated) {
      localStorage.removeItem("token");
      localStorage.removeItem("admin");
      localStorage.setItem("auth_notice", DEACTIVATED_NOTICE);

      if (window.location.pathname !== "/login") {
        window.location.assign("/login?status=deactivated");
      }
    }

    return Promise.reject(error);
  }
);

export default client;
