import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "sonner";
import { AuthProvider, useAuth } from "./lib/auth";
import Layout from "./components/Layout";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Catalog from "./pages/Catalog";
import Suppliers from "./pages/Suppliers";
import ImportCatalog from "./pages/ImportCatalog";
import PricingRules from "./pages/PricingRules";
import Orders from "./pages/Orders";
import WooCommerce from "./pages/WooCommerce";
import Notifications from "./pages/Notifications";
import Automations from "./pages/Automations";
import ApiKeys from "./pages/ApiKeys";

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <div className="p-12 text-sm mono">Chargement…</div>;
  if (!user) return <Navigate to="/login" replace />;
  return <Layout>{children}</Layout>;
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Toaster
          position="top-right"
          toastOptions={{
            style: { borderRadius: 2, border: "1px solid #E4E4E7", fontFamily: "Satoshi, sans-serif" },
          }}
        />
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/" element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/catalogue" element={<PrivateRoute><Catalog /></PrivateRoute>} />
          <Route path="/fournisseurs" element={<PrivateRoute><Suppliers /></PrivateRoute>} />
          <Route path="/import" element={<PrivateRoute><ImportCatalog /></PrivateRoute>} />
          <Route path="/regles-prix" element={<PrivateRoute><PricingRules /></PrivateRoute>} />
          <Route path="/commandes" element={<PrivateRoute><Orders /></PrivateRoute>} />
          <Route path="/woocommerce" element={<PrivateRoute><WooCommerce /></PrivateRoute>} />
          <Route path="/automatisations" element={<PrivateRoute><Automations /></PrivateRoute>} />
          <Route path="/cles-api" element={<PrivateRoute><ApiKeys /></PrivateRoute>} />
          <Route path="/notifications" element={<PrivateRoute><Notifications /></PrivateRoute>} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}
