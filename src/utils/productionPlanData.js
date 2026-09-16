import * as XLSX from "xlsx";
import { productionForecastBaseline } from "./productionForecastBaseline.js";
import { prospectPipelineBaseline } from "./prospectPipelineBaseline.js";

export const FINANCIAL_YEAR_MONTHS = [
  { code: "APR", name: "April", num: "04", defaultYear: 2026, monthKey: "2026-04", order: 1 },
  { code: "MAY", name: "May", num: "05", defaultYear: 2026, monthKey: "2026-05", order: 2 },
  { code: "JUN", name: "June", num: "06", defaultYear: 2026, monthKey: "2026-06", order: 3 },
  { code: "JUL", name: "July", num: "07", defaultYear: 2026, monthKey: "2026-07", order: 4 },
  { code: "AUG", name: "August", num: "08", defaultYear: 2026, monthKey: "2026-08", order: 5 },
  { code: "SEP", name: "September", num: "09", defaultYear: 2026, monthKey: "2026-09", order: 6 },
  { code: "OCT", name: "October", num: "10", defaultYear: 2026, monthKey: "2026-10", order: 7 },
  { code: "NOV", name: "November", num: "11", defaultYear: 2026, monthKey: "2026-11", order: 8 },
  { code: "DEC", name: "December", num: "12", defaultYear: 2026, monthKey: "2026-12", order: 9 },
  { code: "JAN", name: "January", num: "01", defaultYear: 2027, monthKey: "2027-01", order: 10 },
  { code: "FEB", name: "February", num: "02", defaultYear: 2027, monthKey: "2027-02", order: 11 },
  { code: "MAR", name: "March", num: "03", defaultYear: 2027, monthKey: "2027-03", order: 12 }
];

export const SALES_OFFICERS = [
  { code: "DP", name: "DP", department: "Horticulture", color: "#10b981" },
  { code: "HR", name: "HR", department: "Horticulture", color: "#3b82f6" },
  { code: "MM", name: "MM", department: "Horticulture", color: "#8b5cf6" },
  { code: "PD", name: "PD", department: "Bedding", color: "#f59e0b" }
];

export const DEPARTMENTS = ["Horticulture", "Bedding", "Coir Products", "Other"];

export function getDepartmentForOfficer(officerCode) {
  if (!officerCode) return "Horticulture";
  const upper = String(officerCode).trim().toUpperCase();
  if (upper === "PD") return "Bedding";
  return "Horticulture";
}

/**
 * Calculates default 4 months rolling window (Current month + next 3 months)
 */
export function getDefaultRollingMonths(referenceDate = new Date()) {
  const result = [];
  const start = new Date(referenceDate);
  for (let i = 0; i < 4; i++) {
    const d = new Date(start.getFullYear(), start.getMonth() + i, 1);
    const yr = d.getFullYear();
    const mNum = String(d.getMonth() + 1).padStart(2, "0");
    const mCode = d.toLocaleString("en-US", { month: "short" }).toUpperCase();
    const monthKey = `${yr}-${mNum}`;
    const monthName = d.toLocaleString("en-US", { month: "long" }) + " " + yr;
    result.push({
      year: yr,
      month: mCode,
      monthKey,
      monthName,
      monthNum: mNum
    });
  }
  return result;
}

/**
 * Recalculates metrics, variances, achievement rate and status for a row
 */
export function calculateRowMetrics(row) {
  const bTeu = parseFloat(row.budgetTeu) || 0;
  const bTo = parseFloat(row.budgetTurnover) || 0;
  const bCont = parseFloat(row.budgetContribution) || 0;
  const bMargin = bTo > 0 ? (bCont / bTo) : (parseFloat(row.budgetMargin) || 0);

  const aTeu = parseFloat(row.actualTeu) || 0;
  const aTo = parseFloat(row.actualTurnover) || 0;
  const aCont = parseFloat(row.actualContribution) || 0;
  const aMargin = aTo > 0 ? (aCont / aTo) : (parseFloat(row.actualMargin) || 0);

  const fTeu = row.factoryTeu !== undefined && row.factoryTeu !== null && row.factoryTeu !== "" 
    ? (parseFloat(row.factoryTeu) || 0) 
    : (row.factoryConfirmed ? aTeu : 0);
  
  let fTo = parseFloat(row.factoryTurnover) || 0;
  let fCont = parseFloat(row.factoryContribution) || 0;
  if (aTeu > 0 && fTeu > 0 && fTo === 0) {
    fTo = Math.round((fTeu / aTeu) * aTo * 100) / 100;
    fCont = Math.round((fTeu / aTeu) * aCont * 100) / 100;
  }

  const varTeu = Math.round((aTeu - bTeu) * 100) / 100;
  const varTo = Math.round((aTo - bTo) * 100) / 100;
  const varCont = Math.round((aCont - bCont) * 100) / 100;

  let achRate = 0;
  if (bTo > 0) {
    achRate = Math.round((aTo / bTo) * 100);
  } else if (aTo > 0) {
    achRate = 100;
  }

  let status = "pending";
  if (bTo === 0 && aTo > 0) {
    status = "new";
  } else if (aTo >= bTo && bTo > 0) {
    status = "met";
  } else if (aTo < bTo && (aTo > 0 || bTo > 0)) {
    status = "variance";
  }

  return {
    ...row,
    department: row.department || getDepartmentForOfficer(row.salesOfficer),
    budgetTeu: bTeu,
    budgetTurnover: bTo,
    budgetContribution: bCont,
    budgetMargin: Math.round(bMargin * 10000) / 10000,
    actualTeu: aTeu,
    actualTurnover: aTo,
    actualContribution: aCont,
    actualMargin: Math.round(aMargin * 10000) / 10000,
    factoryTeu: fTeu,
    factoryTurnover: fTo,
    factoryContribution: fCont,
    varianceTeu: varTeu,
    varianceTurnover: varTo,
    varianceContribution: varCont,
    achievementRate: achRate,
    status: status
  };
}

/**
 * Format currency with commas and precision
 */
export function formatCurrency(num, decimals = 0) {
  if (num === null || num === undefined || isNaN(num)) return "0";
  return Number(num).toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals
  });
}

/**
 * Format compact currency e.g. 14.2M
 */
export function formatCompactCurrency(num) {
  if (!num || isNaN(num)) return "0";
  const abs = Math.abs(num);
  if (abs >= 1_000_000_000) {
    return (num / 1_000_000_000).toFixed(2) + "B";
  }
  if (abs >= 1_000_000) {
    return (num / 1_000_000).toFixed(2) + "M";
  }
  if (abs >= 1_000) {
    return (num / 1_000).toFixed(1) + "K";
  }
  return num.toLocaleString();
}

/**
 * Format percentage string
 */
export function formatPercentage(val) {
  if (val === null || val === undefined || isNaN(val)) return "0%";
  const num = typeof val === "number" ? val : parseFloat(val);
  if (num <= 1 && num > 0) {
    return (num * 100).toFixed(1) + "%";
  }
  return num.toFixed(1) + "%";
}

/**
 * Aggregate executive performance data matching PPT output data (Sheet 3)
 */
export function generatePptExecutiveSummary(rows = []) {
  const categories = {
    Horticulture: {
      bTeu: 0, bTo: 0, bCont: 0,
      aTeu: 0, aTo: 0, aCont: 0,
      fTeu: 0, fTo: 0, fCont: 0
    },
    Bedding: {
      bTeu: 0, bTo: 0, bCont: 0,
      aTeu: 0, aTo: 0, aCont: 0,
      fTeu: 0, fTo: 0, fCont: 0
    },
    Total: {
      bTeu: 0, bTo: 0, bCont: 0,
      aTeu: 0, aTo: 0, aCont: 0,
      fTeu: 0, fTo: 0, fCont: 0
    }
  };

  rows.forEach(r => {
    const dept = r.department === "Bedding" || r.salesOfficer === "PD" ? "Bedding" : "Horticulture";
    const target = categories[dept];

    const bTeu = parseFloat(r.budgetTeu) || 0;
    const bTo = parseFloat(r.budgetTurnover) || 0;
    const bCont = parseFloat(r.budgetContribution) || 0;

    const aTeu = parseFloat(r.actualTeu) || 0;
    const aTo = parseFloat(r.actualTurnover) || 0;
    const aCont = parseFloat(r.actualContribution) || 0;

    const fTeu = parseFloat(r.factoryTeu) || (r.factoryConfirmed ? aTeu : 0);
    const fTo = parseFloat(r.factoryTurnover) || (r.factoryConfirmed ? aTo : 0);
    const fCont = parseFloat(r.factoryContribution) || (r.factoryConfirmed ? aCont : 0);

    target.bTeu += bTeu;
    target.bTo += bTo;
    target.bCont += bCont;

    target.aTeu += aTeu;
    target.aTo += aTo;
    target.aCont += aCont;

    target.fTeu += fTeu;
    target.fTo += fTo;
    target.fCont += fCont;

    categories.Total.bTeu += bTeu;
    categories.Total.bTo += bTo;
    categories.Total.bCont += bCont;

    categories.Total.aTeu += aTeu;
    categories.Total.aTo += aTo;
    categories.Total.aCont += aCont;

    categories.Total.fTeu += fTeu;
    categories.Total.fTo += fTo;
    categories.Total.fCont += fCont;
  });

  const buildDeptSummary = (name, d) => {
    const bMargin = d.bTo > 0 ? (d.bCont / d.bTo) : 0;
    const aMargin = d.aTo > 0 ? (d.aCont / d.aTo) : 0;
    const vTeu = d.aTeu - d.bTeu;
    const vTo = d.aTo - d.bTo;
    const vCont = d.aCont - d.bCont;
    const ach = d.bTo > 0 ? (d.aTo / d.bTo) * 100 : (d.aTo > 0 ? 100 : 0);

    return {
      category: name,
      budget: { teu: d.bTeu, to: d.bTo, cont: d.bCont, margin: bMargin },
      actual: { teu: d.aTeu, to: d.aTo, cont: d.aCont, margin: aMargin },
      factory: { teu: d.fTeu, to: d.fTo, cont: d.fCont },
      variance: { teu: vTeu, to: vTo, cont: vCont, achievementRate: ach }
    };
  };

  return {
    horticulture: buildDeptSummary("Horticulture", categories.Horticulture),
    bedding: buildDeptSummary("Bedding", categories.Bedding),
    total: buildDeptSummary("Total", categories.Total)
  };
}

/**
 * Export rows to clean Excel file matching the template structure
 */
export function exportForecastToExcel(rows = [], filename = "Production_Forecast_Report.xlsx") {
  const worksheetData = [
    [
      "MONTH / YEAR",
      "SALES OFFICER",
      "BUYER / CUSTOMER",
      "DEPARTMENT",
      "BUDGET TEU",
      "BUDGET TO-FOB (LKR)",
      "BUDGET TOTAL CONTRI",
      "BUDGET MARGIN %",
      "ACTUAL TEU",
      "ACTUAL TO-FOB (LKR)",
      "ACTUAL TOTAL CONTRI",
      "ACTUAL MARGIN %",
      "VARIANCE TEU",
      "VARIANCE TO-FOB (LKR)",
      "VARIANCE CONTRI",
      "ACHIEVEMENT %",
      "STATUS",
      "FACTORY TEU",
      "FACTORY TO-FOB",
      "FACTORY CONFIRMED",
      "NOTES"
    ]
  ];

  rows.forEach(r => {
    worksheetData.push([
      r.monthName || r.monthKey || r.month,
      r.salesOfficer,
      r.buyer,
      r.department,
      r.budgetTeu || 0,
      r.budgetTurnover || 0,
      r.budgetContribution || 0,
      r.budgetMargin ? `${(r.budgetMargin * 100).toFixed(1)}%` : "0%",
      r.actualTeu || 0,
      r.actualTurnover || 0,
      r.actualContribution || 0,
      r.actualMargin ? `${(r.actualMargin * 100).toFixed(1)}%` : "0%",
      r.varianceTeu || 0,
      r.varianceTurnover || 0,
      r.varianceContribution || 0,
      `${r.achievementRate || 0}%`,
      r.status?.toUpperCase() || "PENDING",
      r.factoryTeu || 0,
      r.factoryTurnover || 0,
      r.factoryConfirmed ? "YES" : "NO",
      r.notes || ""
    ]);
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(worksheetData);
  XLSX.utils.book_append_sheet(wb, ws, "Forecast Data");
  XLSX.writeFile(wb, filename);
}

export { productionForecastBaseline, prospectPipelineBaseline };
