import React from "react";
import ProductionForecast from "./ProductionForecast";

export default function ProductionFullManagement() {
  return (
    <ProductionForecast
      fixedRoleView="all_editable"
      pageTitle="👑 Production Plan & Forecast (Full Management View)"
      pageSubtitle="Complete master access to baseline budgets, actual deliveries, factory capabilities, and production confirmation"
    />
  );
}
