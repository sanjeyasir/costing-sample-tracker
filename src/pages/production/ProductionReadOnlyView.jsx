import React from "react";
import ProductionForecast from "./ProductionForecast";

export default function ProductionReadOnlyView() {
  return (
    <ProductionForecast
      fixedRoleView="read_only"
      pageTitle="👁️ Production Plan & Forecast (Auditor & Executive Read-Only View)"
      pageSubtitle="Comprehensive financial and operational summary view with protected, locked dimensions"
    />
  );
}
