import {
  BrowserRouter,
  Routes,
  Route,
  Navigate,
} from "react-router-dom";

import Storefront from "./Storefront";
import Reader from "./Reader";
import Admin from "./Admin";
import AdminLogin from "./AdminLogin";
import AdminRoute from "./AdminRoute";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Customer storefront */}
        <Route path="/" element={<Storefront />} />

        {/* Online PDF reader */}
        <Route path="/read/:productId" element={<Reader />} />

        {/* Admin login */}
        <Route path="/admin/login" element={<AdminLogin />} />

        {/* Protected admin dashboard */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <Admin />
            </AdminRoute>
          }
        />

        {/* Unknown routes */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
