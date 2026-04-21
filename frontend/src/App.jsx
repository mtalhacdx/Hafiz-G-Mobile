import { Navigate, Route, Routes } from "react-router-dom";

import ProtectedRoute from "./components/ProtectedRoute";
import LoginPage from "./pages/LoginPage";
import DashboardPage from "./pages/DashboardPage";
import ProductsPage from "./pages/ProductsPage";
import CategoriesPage from "./pages/CategoriesPage";
import BrandsPage from "./pages/BrandsPage";
import SalesPage from "./pages/SalesPage";
import InvoicePrint from "./pages/InvoicePrint";
import PurchasesPage from "./pages/PurchasesPage";
import PurchasePrint from "./pages/PurchasePrint";
import CustomersPage from "./pages/CustomersPage";
import SuppliersPage from "./pages/SuppliersPage";
import ReturnsPage from "./pages/ReturnsPage";
import ClaimsPage from "./pages/ClaimsPage";
import ReportsPage from "./pages/ReportsPage";
import SettingsPage from "./pages/SettingsPage";
import AccessDeniedPage from "./pages/AccessDeniedPage";
import DataBootstrapper from "./components/DataBootstrapper";

const App = () => {
  return (
    <DataBootstrapper>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
      <Route
        path="/products"
        element={
          <ProtectedRoute allowedRoles={["admin", "small_manager"]}>
            <ProductsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/categories"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <CategoriesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/brands"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <BrandsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales"
        element={
          <ProtectedRoute>
            <SalesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/sales/:invoiceId/print"
        element={
          <ProtectedRoute>
            <InvoicePrint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchases"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PurchasesPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/purchases/:invoiceId/print"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <PurchasePrint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/customers"
        element={
          <ProtectedRoute>
            <CustomersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/suppliers"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <SuppliersPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/returns"
        element={
          <ProtectedRoute>
            <ReturnsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/claims"
        element={
          <ProtectedRoute>
            <ClaimsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <ReportsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <SettingsPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/access-denied"
        element={
          <ProtectedRoute>
            <AccessDeniedPage />
          </ProtectedRoute>
        }
      />

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </DataBootstrapper>
  );
};

export default App;
