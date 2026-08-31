import React from "react";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { Spin } from "antd";

export default function ProtectedRoute({ children, allowedRoles, module, allowedModuleRoles }) {
  const { currentUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
        <Spin size="large" tip="Verifying session..." />
      </div>
    );
  }

  if (!currentUser) {
    // Save current path to redirect back after successful login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (currentUser.requirePasswordChange && location.pathname !== "/change-password") {
    return <Navigate to="/change-password" replace />;
  }

  // Admin has complete bypass access
  const costingRoles = currentUser.costingRoles || [];
  const sampleRoles = currentUser.sampleRoles || [];
  const isAdmin = currentUser.roles?.includes("admin") || costingRoles.includes("admin") || sampleRoles.includes("admin");

  // Specific restriction: admin@gmail.com can only access User Management and System Settings
  const isSuperAdminUser = currentUser.email === "admin@gmail.com";
  if (isSuperAdminUser) {
    const path = location.pathname;
    const isAllowedPath = path === "/admin/users" || path === "/admin/settings" || path === "/change-password";
    if (!isAllowedPath) {
      return <Navigate to="/admin/users" replace />;
    }
    return children;
  }

  if (isAdmin) {
    return children;
  }

  if (allowedRoles && !currentUser.roles.some(r => allowedRoles.includes(r))) {
    // If user's roles are not authorized, redirect to their default landing dashboard
    return <Navigate to="/dashboard" replace />;
  }

  if (module && allowedModuleRoles) {
    const userModuleRoles = module === "costing" ? costingRoles : sampleRoles;
    const hasAccess = userModuleRoles.some(r => allowedModuleRoles.includes(r));
    if (!hasAccess) {
      return <Navigate to="/dashboard" replace />;
    }
  }

  return children;
}
