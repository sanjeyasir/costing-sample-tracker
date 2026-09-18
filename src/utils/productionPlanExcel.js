import ExcelJS from "exceljs";
import * as XLSX from "xlsx";
import { 
  FINANCIAL_YEAR_MONTHS, 
  SALES_OFFICERS, 
  DEPARTMENTS, 
  getDepartmentForOfficer, 
  calculateRowMetrics 
} from "./productionPlanData";

/**
 * Generates and downloads a clean Excel template (.xlsx) with embedded cell dropdowns
 * for Month, Sales Officer, and Department using ExcelJS
 */
export async function downloadForecastExcelTemplate(filename = "Production_Forecast_Template.xlsx") {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Toyo Cushion Lanka Pvt Ltd / Hayleys Fibre";
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet("Forecast Entry Template", {
    views: [{ state: "frozen", xSplit: 4, ySplit: 1 }]
  });

  // Define Columns
  worksheet.columns = [
    { header: "YEAR", key: "year", width: 10 },
    { header: "MONTH", key: "month", width: 12 },
    { header: "SALES OFFICER", key: "salesOfficer", width: 16 },
    { header: "BUYER / CUSTOMER", key: "buyer", width: 30 },
    { header: "DEPARTMENT", key: "department", width: 18 },
    { header: "BUDGET TEU", key: "budgetTeu", width: 14 },
    { header: "BUDGET TO-FOB (LKR)", key: "budgetTurnover", width: 22 },
    { header: "BUDGET CONTRI (LKR)", key: "budgetContribution", width: 22 },
    { header: "ACTUAL TEU", key: "actualTeu", width: 14 },
    { header: "ACTUAL TO-FOB (LKR)", key: "actualTurnover", width: 22 },
    { header: "ACTUAL CONTRI (LKR)", key: "actualContribution", width: 22 },
    { header: "FACTORY TEU", key: "factoryTeu", width: 14 },
    { header: "FACTORY CONFIRMED", key: "factoryConfirmed", width: 18 },
    { header: "NOTES / REMARKS", key: "notes", width: 35 }
  ];

  // Header Styling
  const headerRow = worksheet.getRow(1);
  headerRow.height = 30;
  headerRow.eachCell((cell, colNumber) => {
    cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FFFFFFFF" } };
    
    // Group Header Colors
    if (colNumber <= 5) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1E3A8A" } }; // Deep Navy (Info)
    } else if (colNumber <= 8) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF1D4ED8" } }; // Blue (Budget)
    } else if (colNumber <= 11) {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF5B21B6" } }; // Purple (Actuals)
    } else {
      cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F766E" } }; // Teal (Factory/Notes)
    }

    cell.alignment = { vertical: "middle", horizontal: colNumber === 4 || colNumber === 14 ? "left" : "center", wrapText: true };
    cell.border = {
      top: { style: "thin", color: { argb: "FFCBD5E1" } },
      left: { style: "thin", color: { argb: "FFCBD5E1" } },
      bottom: { style: "medium", color: { argb: "FF0F172A" } },
      right: { style: "thin", color: { argb: "FFCBD5E1" } }
    };
  });

  // Example Sample Rows
  const sampleRows = [
    {
      year: 2026,
      month: "SEP",
      salesOfficer: "MM",
      buyer: "PRIDE GARDEN PRODUCTS",
      department: "Horticulture",
      budgetTeu: 1.0,
      budgetTurnover: 2800000,
      budgetContribution: 1120000,
      actualTeu: 1.0,
      actualTurnover: 2850000,
      actualContribution: 1140000,
      factoryTeu: 1.0,
      factoryConfirmed: "YES",
      notes: "Sample entry - modify or add your rows"
    },
    {
      year: 2026,
      month: "SEP",
      salesOfficer: "DP",
      buyer: "DUTCH PLANTIN BV",
      department: "Horticulture",
      budgetTeu: 2.0,
      budgetTurnover: 5200000,
      budgetContribution: 2080000,
      actualTeu: 2.0,
      actualTurnover: 5300000,
      actualContribution: 2120000,
      factoryTeu: 2.0,
      factoryConfirmed: "YES",
      notes: "Container dispatch scheduled"
    },
    {
      year: 2026,
      month: "OCT",
      salesOfficer: "PD",
      buyer: "RECTICEL NV",
      department: "Bedding",
      budgetTeu: 1.5,
      budgetTurnover: 4200000,
      budgetContribution: 1680000,
      actualTeu: 0,
      actualTurnover: 0,
      actualContribution: 0,
      factoryTeu: 0,
      factoryConfirmed: "NO",
      notes: "Forward forecast"
    }
  ];

  sampleRows.forEach((row, rIdx) => {
    const rowObj = worksheet.addRow(row);
    rowObj.height = 22;
    rowObj.eachCell((cell, colNumber) => {
      cell.font = { name: "Arial", size: 9.5 };
      cell.border = {
        top: { style: "thin", color: { argb: "FFE2E8F0" } },
        left: { style: "thin", color: { argb: "FFE2E8F0" } },
        bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
        right: { style: "thin", color: { argb: "FFE2E8F0" } }
      };

      if ([6, 9, 12].includes(colNumber)) {
        cell.numFmt = "0.00";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if ([7, 8, 10, 11].includes(colNumber)) {
        cell.numFmt = "#,##0";
        cell.alignment = { horizontal: "right", vertical: "middle" };
      } else if ([1, 2, 3, 5, 13].includes(colNumber)) {
        cell.alignment = { horizontal: "center", vertical: "middle" };
      } else {
        cell.alignment = { horizontal: "left", vertical: "middle" };
      }
    });
  });

  // Apply In-Cell Dropdown Data Validations (Rows 2 through 1000)
  const monthListFormula = '"APR,MAY,JUN,JUL,AUG,SEP,OCT,NOV,DEC,JAN,FEB,MAR"';
  const officerListFormula = '"DP,HR,MM,PD"';
  const deptListFormula = '"Horticulture,Bedding,Coir Products,Other"';
  const confirmListFormula = '"YES,NO"';

  for (let r = 2; r <= 1000; r++) {
    // Column B: Month
    worksheet.getCell(`B${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [monthListFormula],
      showErrorMessage: true,
      errorTitle: "Invalid Month",
      error: "Please pick a valid 3-letter month code (e.g. SEP, OCT)"
    };

    // Column C: Sales Officer
    worksheet.getCell(`C${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [officerListFormula],
      showErrorMessage: true,
      errorTitle: "Invalid Sales Officer",
      error: "Please pick from DP, HR, MM, PD"
    };

    // Column E: Department
    worksheet.getCell(`E${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [deptListFormula],
      showErrorMessage: true,
      errorTitle: "Invalid Department",
      error: "Please pick Horticulture or Bedding"
    };

    // Column M: Factory Confirmed
    worksheet.getCell(`M${r}`).dataValidation = {
      type: "list",
      allowBlank: true,
      formulae: [confirmListFormula],
      showErrorMessage: true
    };
  }

  // Generate buffer and trigger browser download
  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  window.URL.revokeObjectURL(url);
  return true;
}

/**
 * Parses an uploaded Excel file (.xlsx / .xls) and validates the forecast entries
 * @param {File} file - Browser File object from input / dropzone
 */
export async function parseProductionForecastExcel(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          return resolve({ rows: [], warnings: ["The uploaded sheet contains no data rows."], errors: [] });
        }

        const parsedRows = [];
        const warnings = [];
        const errors = [];

        rawJson.forEach((row, idx) => {
          const rowNum = idx + 2; // 1-indexed including header
          
          // Map flexible header variations
          const yearRaw = row["YEAR"] || row["Year"] || row["year"] || 2026;
          const monthRaw = String(row["MONTH"] || row["Month"] || row["month"] || row["MONTH / YEAR"] || "").trim().toUpperCase();
          const officerRaw = String(row["SALES OFFICER"] || row["Sales Officer"] || row["Officer"] || row["officer"] || "MM").trim().toUpperCase();
          const buyerRaw = String(row["BUYER / CUSTOMER"] || row["Buyer / Customer"] || row["Buyer"] || row["Customer"] || row["buyer"] || "").trim();
          const deptRaw = String(row["DEPARTMENT"] || row["Department"] || row["dept"] || "").trim();

          // Skip completely empty spacer rows
          if (!buyerRaw && !monthRaw) return;

          if (!buyerRaw) {
            warnings.push(`Row ${rowNum}: Skipped because Buyer/Customer name is missing.`);
            return;
          }

          const year = parseInt(yearRaw, 10) || 2026;
          
          // Match month code
          let matchedMonthObj = FINANCIAL_YEAR_MONTHS.find(m => 
            monthRaw.includes(m.code) || 
            monthRaw.toLowerCase().includes(m.name.toLowerCase()) ||
            m.monthKey === monthRaw
          );

          if (!matchedMonthObj) {
            matchedMonthObj = FINANCIAL_YEAR_MONTHS.find(m => m.code === "SEP") || FINANCIAL_YEAR_MONTHS[0];
            warnings.push(`Row ${rowNum} (${buyerRaw}): Month '${monthRaw}' not recognized, defaulted to SEP.`);
          }

          const bTeu = parseFloat(row["BUDGET TEU"] || row["Budget TEU"] || row["budgetTeu"] || 0) || 0;
          const bTo = parseFloat(row["BUDGET TO-FOB (LKR)"] || row["Budget TO-FOB"] || row["budgetTurnover"] || row["Budget TO"] || 0) || 0;
          const bCont = parseFloat(row["BUDGET CONTRI (LKR)"] || row["Budget Contribution"] || row["budgetContribution"] || row["Budget Contri"] || 0) || (bTo * 0.4);

          const aTeu = parseFloat(row["ACTUAL TEU"] || row["Actual TEU"] || row["actualTeu"] || 0) || 0;
          const aTo = parseFloat(row["ACTUAL TO-FOB (LKR)"] || row["Actual TO-FOB"] || row["actualTurnover"] || row["Actual TO"] || 0) || 0;
          const aCont = parseFloat(row["ACTUAL CONTRI (LKR)"] || row["Actual Contribution"] || row["actualContribution"] || row["Actual Contri"] || 0) || (aTo * 0.4);

          const fTeu = parseFloat(row["FACTORY TEU"] || row["Factory TEU"] || row["factoryTeu"] || 0) || 0;
          const fConfirmedRaw = String(row["FACTORY CONFIRMED"] || row["Factory Confirmed"] || row["factoryConfirmed"] || "").trim().toUpperCase();
          const fConfirmed = fConfirmedRaw === "YES" || fConfirmedRaw === "TRUE" || fConfirmedRaw === "1";
          const notes = String(row["NOTES / REMARKS"] || row["Notes"] || row["notes"] || row["Remarks"] || "").trim();

          const department = deptRaw || getDepartmentForOfficer(officerRaw);

          // Calculate full metrics
          const calculated = calculateRowMetrics({
            id: `fc-imp-${Date.now()}-${idx}-${Math.random().toString(36).substr(2, 4)}`,
            year: matchedMonthObj.defaultYear || year,
            month: matchedMonthObj.code,
            monthName: `${matchedMonthObj.name} ${matchedMonthObj.defaultYear || year}`,
            monthKey: matchedMonthObj.monthKey,
            salesOfficer: officerRaw || "MM",
            buyer: buyerRaw,
            department: department,
            budgetTeu: bTeu,
            budgetTurnover: bTo,
            budgetContribution: bCont,
            actualTeu: aTeu,
            actualTurnover: aTo,
            actualContribution: aCont,
            factoryTeu: fTeu,
            factoryConfirmed: fConfirmed,
            notes: notes
          });

          parsedRows.push(calculated);
        });

        resolve({
          rows: parsedRows,
          warnings,
          errors,
          totalParsed: parsedRows.length
        });
      } catch (err) {
        console.error("Excel parse error:", err);
        reject(new Error("Failed to parse Excel file. Please ensure it is a valid .xlsx or .xls file."));
      }
    };

    reader.onerror = () => reject(new Error("File read failed."));
    reader.readAsArrayBuffer(file);
  });
}
