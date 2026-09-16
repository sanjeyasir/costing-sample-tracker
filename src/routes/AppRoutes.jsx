import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import ProtectedRoute from "../components/common/ProtectedRoute";
import DashboardLayout from "../components/layout/DashboardLayout";

// Import Pages
import Login from "../pages/auth/Login";
import ForgotPassword from "../pages/auth/ForgotPassword";
import Dashboard from "../pages/dashboard/Dashboard";
import CostRequests from "../pages/costing/CostRequests";
import CreateRequest from "../pages/costing/CreateRequest";
import RequestDetails from "../pages/costing/RequestDetails";
import QuotationEditor from "../pages/costing/QuotationEditor";
import SampleRequests from "../pages/costing/SampleRequests";
import CreateSampleRequest from "../pages/costing/CreateSampleRequest";
import SampleRequestDetails from "../pages/costing/SampleRequestDetails";
import Reports from "../pages/reports/Reports";
import Users from "../pages/admin/Users";
import Categories from "../pages/admin/Categories";
import Settings from "../pages/admin/Settings";
import ChangePassword from "../pages/auth/ChangePassword";
import Notifications from "../pages/notifications/Notifications";
import DispatchList from "../pages/dispatch/DispatchList";
import DispatchEditor from "../pages/dispatch/DispatchEditor";
import DispatchDetails from "../pages/dispatch/DispatchDetails";
import SalesOfficerProfile from "../pages/admin/SalesOfficerProfile";
import ProductionForecast from "../pages/production/ProductionForecast";
import ProductionDashboard from "../pages/production/ProductionDashboard";
import ProspectPipeline from "../pages/production/ProspectPipeline";

export default function AppRoutes() {

  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />

      {/* Standalone Protected Route for First Login Password resets */}
      <Route
        path="/change-password"
        element={
          <ProtectedRoute>
            <ChangePassword />
          </ProtectedRoute>
        }
      />

      {/* Protected Dashboard Layout Routes */}
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Dashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />
      
      {/* Costing Management Routes */}
      <Route
        path="/costing-requests"
        element={
          <ProtectedRoute module="costing" allowedModuleRoles={["costing_marketing", "costing_finance", "costing_viewer"]}>
            <DashboardLayout>
              <CostRequests />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/costing-requests/create"
        element={
          <ProtectedRoute module="costing" allowedModuleRoles={["costing_marketing"]}>
            <DashboardLayout>
              <CreateRequest />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/costing-requests/:id"
        element={
          <ProtectedRoute module="costing" allowedModuleRoles={["costing_marketing", "costing_finance", "costing_viewer"]}>
            <DashboardLayout>
              <RequestDetails />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/costing-requests/:id/quotation"
        element={
          <ProtectedRoute module="costing" allowedModuleRoles={["costing_marketing", "costing_finance", "costing_viewer"]}>
            <DashboardLayout>
              <QuotationEditor />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Sample Requisitions Routes */}
      <Route
        path="/requests"
        element={
          <ProtectedRoute module="sample" allowedModuleRoles={["sample_marketing", "sample_sampling", "sample_viewer"]}>
            <DashboardLayout>
              <SampleRequests />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/requests/create"
        element={
          <ProtectedRoute module="sample" allowedModuleRoles={["sample_marketing"]}>
            <DashboardLayout>
              <CreateSampleRequest />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/requests/:id"
        element={
          <ProtectedRoute module="sample" allowedModuleRoles={["sample_marketing", "sample_sampling", "sample_viewer"]}>
            <DashboardLayout>
              <SampleRequestDetails />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/reports"
        element={
          <ProtectedRoute module="sample" allowedModuleRoles={["sample_marketing", "sample_sampling", "sample_viewer"]}>
            <DashboardLayout>
              <Reports />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Dispatch Tracker Routes */}
      <Route
        path="/dispatch-tracker"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DispatchList />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dispatch-tracker/create"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DispatchEditor />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dispatch-tracker/:id"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DispatchDetails />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/dispatch-tracker/:id/edit"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <DispatchEditor />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />



      {/* Production Forecast & Planning Routes */}
      <Route
        path="/production-forecast"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ProductionForecast />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/production-forecast/dashboard"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ProductionDashboard />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/production-forecast/prospects"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <ProspectPipeline />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/sales-officer-profile"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <SalesOfficerProfile />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/notifications"
        element={
          <ProtectedRoute>
            <DashboardLayout>
              <Notifications />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Admin Specific Routes */}
      <Route
        path="/admin/users"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <DashboardLayout>
              <Users />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/categories"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <DashboardLayout>
              <Categories />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/admin/settings"
        element={
          <ProtectedRoute allowedRoles={["admin"]}>
            <DashboardLayout>
              <Settings />
            </DashboardLayout>
          </ProtectedRoute>
        }
      />

      {/* Fallback Catch-all Route */}
      <Route path="*" element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}
