import React from "react";
import ProductionForecast from "./ProductionForecast";

export default function ProductionFactoryView() {
  return (
    <ProductionForecast
      fixedRoleView="factory_performance"
      pageTitle="🏭 Production Performance & Confirmation (Factory Team View)"
      pageSubtitle="Factory operations view for setting capable TEUs, evaluating proportional turnover ratios, and confirming production"
    />
  );
}
