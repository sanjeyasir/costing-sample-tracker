import React from "react";
import ProductionForecast from "./ProductionForecast";

export default function ProductionMarketingView() {
  return (
    <ProductionForecast
      fixedRoleView="marketing_actuals"
      pageTitle="📈 Production Forecast & Actuals (Marketing Team View)"
      pageSubtitle="Marketing department view for entering and tracking monthly actual deliveries against initial budget targets"
    />
  );
}
