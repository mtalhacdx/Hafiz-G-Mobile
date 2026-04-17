import { Navigate, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const location = useLocation();
  const { token, admin } = useSelector((state) => state.auth);

  if (!token) {
    return <Navigate to="/login" replace />;
  }

  if (Array.isArray(allowedRoles) && allowedRoles.length > 0) {
    const role = admin?.role || "admin";
    if (!allowedRoles.includes(role)) {
      return <Navigate to="/access-denied" replace state={{ from: location.pathname }} />;
    }
  }

  return children;
};

export default ProtectedRoute;
