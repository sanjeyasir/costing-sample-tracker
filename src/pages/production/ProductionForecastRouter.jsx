import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

export default function ProductionForecastRouter() {
  const { currentUser } = useAuth();
  const userRoles = currentUser?.roles || [];
  const prodRoles = currentUser?.productionRoles || [];
  const isSuperAdmin = currentUser?.email === "admin@gmail.com" || userRoles.includes("admin");
  const isProdAdmin = isSuperAdmin || prodRoles.includes("production_all") || prodRoles.includes("admin");
  const isFactoryTeam = !isProdAdmin && prodRoles.includes("production_factory");
  const isMarketingTeam = !isProdAdmin && !isFactoryTeam && (
    prodRoles.includes("production_marketing") || 
    userRoles.includes("costing_marketing") || 
    userRoles.includes("sample_marketing")
  );

  if (isProdAdmin) {
    return <Navigate to="/production-forecast/full-management" replace />;
  }
  if (isMarketingTeam) {
    return <Navigate to="/production-forecast/marketing" replace />;
  }
  if (isFactoryTeam) {
    return <Navigate to="/production-forecast/factory" replace />;
  }
  return <Navigate to="/production-forecast/read-only" replace />;
}
