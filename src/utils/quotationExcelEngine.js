import ExcelJS from "exceljs";
import { 
  DEFAULT_COMPANY_DETAILS, 
  DEFAULT_FINANCIAL_PARAMS,
  getDisplayPrice 
} from "./quotationCalculations";

/**
 * Load image URL or base64 data string into base64 data URL
 */
const loadImageBase64 = (url) => {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    if (typeof url === "string" && url.startsWith("data:image")) {
      return resolve(url);
    }
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        resolve(canvas.toDataURL("image/jpeg"));
      } catch (e) {
        resolve(null);
      }
    };
    img.onerror = () => resolve(null);
    img.src = url;
  });
};

/**
 * Generate and download the official Price Quotation Excel file (.xlsx)
 * Mirrors the exact structure, formatting, embedded images, and formulas in PriceQuotation.xlsx
 */
export async function generateQuotationExcel(quotationData) {
  const {
    quotationNo = "PQ-001",
    quotationDate = new Date().toISOString().split("T")[0],
    category = "bedding",
    buyerName = "Customer",
    shipper = DEFAULT_COMPANY_DETAILS,
    financialParams = DEFAULT_FINANCIAL_PARAMS,
    containerSize = "40ft",
    priceTerm = "FOB",
    paymentTerms = "100% Advance (For the first order delivery)",
    leadTime = "+/- 10% 4-5 weeks",
    validity = "30 Days from date of quotation",
    packing = category === "bedding" ? "Floor load / Pallet" : "Carton Boxes / Floor load / Pallet",
    items = [],
    costRequest = {}
  } = quotationData;

  // Pre-load all item images to base64
  const itemImagesBase64 = await Promise.all(
    items.map(item => loadImageBase64(item.imageUrl))
  );

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Toyo Cushion Lanka";
  workbook.created = new Date();

  const isBedding = category.toLowerCase().includes("bed");

  if (isBedding) {
    buildBeddingQuotationSheet(workbook, quotationData, itemImagesBase64);
    buildBeddingDataEntrySheet(workbook, quotationData);
  } else {
    buildHortiQuotationSheet(workbook, quotationData, itemImagesBase64);
    buildHortiDataEntrySheet(workbook, quotationData);
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `Price_Quotation_${quotationNo}_${buyerName.replace(/\s+/g, "_")}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Helper to convert 1-based column index to Excel column letter (e.g. 1 -> A, 27 -> AA)
 */
function getColumnLetter(colIndex) {
  let letter = "";
  let temp = colIndex;
  while (temp > 0) {
    let remainder = (temp - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    temp = Math.floor((temp - 1) / 26);
  }
  return letter || "A";
}

// --------------------------------------------------------------------------
// 1. BEDDING QUOTATION SHEET (SHEET 1)
// --------------------------------------------------------------------------
function buildBeddingQuotationSheet(workbook, data, itemImagesBase64 = []) {
  const ws = workbook.addWorksheet("Quotation Format");
  ws.views = [{ showGridLines: true }];
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const MASTER_BEDDING_COLS = [
    { key: "idx", dataKey: "idx", header1: "#", header2: "#", width: 5, align: "center", getVal: (item, idx) => idx + 1 },
    { key: "imageUrl", dataKey: "imageUrl", header1: "Image", header2: "Images common", width: 16, align: "center", isImage: true },
    { key: "description", dataKey: "description", header1: "Product spec", header2: "As per cost req data", width: 34, align: "left", getVal: (item, idx) => item.description || item.specifications || `Item #${idx + 1}` },
    { key: "length", dataKey: "length", header1: "L (CM)", header2: "100 (As per req)", width: 10, align: "center", getVal: (item) => item.length || 100 },
    { key: "width", dataKey: "width", header1: "W (CM)", header2: "100 (As per req)", width: 10, align: "center", getVal: (item) => item.width || 100 },
    { key: "height", dataKey: "height", header1: "H (CM)", header2: "10 (As per req)", width: 10, align: "center", getVal: (item) => item.height || 10 },
    { key: "organic", dataKey: "organic", header1: "Organic/Non Org", header2: "Organic/Non-Org", width: 16, align: "center", getVal: (item) => item.organic || "Non-Organic" },
    { key: "ncRcRatio", dataKey: "ncRcRatio", header1: "NC/RC Ratio", header2: "80:20 (As per req)", width: 14, align: "center", getVal: (item) => item.ncRcRatio || "80:20" },
    { key: "density", dataKey: "density", header1: "Density", header2: "80 kg/m3", width: 13, align: "center", getVal: (item) => item.density || "80 kg/m3" },
    { key: "qtyPerBundle", dataKey: "qtyPerBundle", header1: "Qty per BUNDLE", header2: "As per req", width: 15, align: "center", getVal: (item) => item.qtyPerBundle || 1 },
    { key: "palletSize", dataKey: "palletSize", header1: "Pallet size", header2: "If applicable", width: 14, align: "center", getVal: (item) => item.palletSize || "TBA" },
    { key: "bundlesPerPallet", dataKey: "bundlesPerPallet", header1: "Bundles per pallet", header2: "AS per cost req", width: 18, align: "center", getVal: (item) => item.bundlesPerPallet || 0 },
    { key: "palletsPer20ft", dataKey: "palletsPer20ft", header1: "Pallets per 20ft", header2: "Marketing to fill", width: 16, align: "center", getVal: (item) => item.palletsPer20ft || 0 },
    { key: "palletsPer40ft", dataKey: "palletsPer40ft", header1: "Pallets per 40ft", header2: "Marketing to fill", width: 16, align: "center", getVal: (item) => item.palletsPer40ft || 0 },
    { key: "quotedPrice", dataKey: "quotedPrice", header1: "Price FOB /cif/Ex works", header2: "Auto calculated price", width: 22, align: "center", isPrice: true, getFormula: (rIdx) => `'Data Entry'!R${rIdx}`, getVal: (item, idx, dispPrice) => dispPrice.label },
    { key: "bundlesPer20ft", dataKey: "bundlesPer20ft", header1: "Bundles per 20ft", header2: "Auto cal", width: 16, align: "center", getFormula: (rIdx) => `'Data Entry'!N${rIdx}`, getVal: (item) => item.bundlesPer20ft || 0 },
    { key: "qtyPer20ft", dataKey: "qtyPer20ft", header1: "Qty per 20ft", header2: "Auto pick", width: 16, align: "center", getFormula: (rIdx) => `'Data Entry'!Q${rIdx}`, getVal: (item) => item.qtyPer20ft || 0 },
    { key: "bundlesPer40ft", dataKey: "bundlesPer40ft", header1: "Bundles per 40ft", header2: "Auto cal", width: 16, align: "center", getFormula: (rIdx) => `'Data Entry'!O${rIdx}`, getVal: (item) => item.bundlesPer40ft || 0 },
    { key: "qtyPer40ft", dataKey: "qtyPer40ft", header1: "Qty per 40ft", header2: "Auto pick", width: 16, align: "center", getFormula: (rIdx) => `'Data Entry'!P${rIdx}`, getVal: (item) => item.qtyPer40ft || 0 }
  ];

  // Filter columns based strictly on unchecked / selected columns
  const selected = data.selectedColumns;
  let activeCols = MASTER_BEDDING_COLS;
  if (Array.isArray(selected) && selected.length > 0) {
    activeCols = MASTER_BEDDING_COLS.filter(c => selected.includes(c.dataKey) || selected.includes(c.key));
  }
  if (activeCols.length === 0) activeCols = MASTER_BEDDING_COLS;
  const numCols = activeCols.length;

  activeCols.forEach((col, idx) => {
    ws.getColumn(idx + 1).width = col.width;
  });

  // Row 1: Blank
  ws.addRow([]);

  // Row 2: Title Box & Ref No
  const r2 = ws.addRow([]);
  r2.height = 28;
  const titleCol = Math.min(3, Math.max(1, Math.floor(numCols / 2)));
  r2.getCell(titleCol).value = "Price Quotation";
  r2.getCell(titleCol).font = { name: "Arial", size: 16, bold: true, color: { argb: "FF1E3A8A" } };
  r2.getCell(titleCol).alignment = { vertical: "middle" };

  const refLabelCol = Math.max(titleCol + 1, numCols - 1);
  const refValCol = numCols;
  r2.getCell(refLabelCol).value = "Quotation ref number :";
  r2.getCell(refLabelCol).font = { name: "Arial", size: 9.5, bold: true };
  r2.getCell(refLabelCol).alignment = { vertical: "middle", horizontal: "right" };
  r2.getCell(refValCol).value = data.quotationNo;
  r2.getCell(refValCol).font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF0284C7" } };
  r2.getCell(refValCol).alignment = { vertical: "middle", horizontal: "left" };

  // Row 3: Blank
  ws.addRow([]);

  // Row 4: Date
  const r4 = ws.addRow([]);
  r4.getCell(refLabelCol).value = "Date :";
  r4.getCell(refLabelCol).font = { name: "Arial", size: 9.5, bold: true };
  r4.getCell(refLabelCol).alignment = { vertical: "middle", horizontal: "right" };
  r4.getCell(refValCol).value = data.quotationDate;
  r4.getCell(refValCol).font = { name: "Arial", size: 9.5 };
  r4.getCell(refValCol).alignment = { vertical: "middle", horizontal: "left" };

  // Row 5: Blank
  ws.addRow([]);

  // Row 6: Shipper & Buyer
  const r6 = ws.addRow([]);
  const splitMid = Math.max(2, Math.floor(numCols / 2));

  r6.getCell(2).value = "Shipper :";
  r6.getCell(2).font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF1E3A8A" } };
  r6.getCell(3).value = `${data.shipper.shipperName || "Toyo Cushion Lanka"}\nCOMPANY NO : ${data.shipper.companyNo || "PV 5492"}\n${data.shipper.address || "400 Deans Road Colombo 10 01000 Sri Lanka"}\nTel: ${data.shipper.phone || "94112232939-Fixed"}`;
  r6.getCell(3).font = { name: "Arial", size: 8.5 };
  r6.getCell(3).alignment = { wrapText: true, vertical: "top" };
  if (splitMid >= 3) {
    ws.mergeCells(`C6:${getColumnLetter(splitMid)}7`);
  }

  const buyerStartCol = splitMid + 1;
  if (buyerStartCol <= numCols) {
    r6.getCell(buyerStartCol).value = "Buyer :";
    r6.getCell(buyerStartCol).font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF1E3A8A" } };
    const buyerValCol = buyerStartCol + 1 <= numCols ? buyerStartCol + 1 : buyerStartCol;
    r6.getCell(buyerValCol).value = `${data.buyerName}\nCategory: BEDDING | Pricing Term: ${data.priceTerm} (${data.containerSize} Container)`;
    r6.getCell(buyerValCol).font = { name: "Arial", size: 9, bold: true };
    r6.getCell(buyerValCol).alignment = { wrapText: true, vertical: "top" };
    if (numCols >= buyerValCol) {
      ws.mergeCells(`${getColumnLetter(buyerValCol)}6:${getColumnLetter(numCols)}7`);
    }
  }

  ws.addRow([]); // Row 7 merged spacer
  ws.addRow([]); // Row 8 blank spacer

  // Row 9: 2-Tier Header 1
  const hRow1 = ws.addRow(activeCols.map(c => c.header1));
  hRow1.height = 24;
  hRow1.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  // Row 10: 2-Tier Header 2
  const hRow2 = ws.addRow(activeCols.map(c => c.header2));
  hRow2.height = 20;
  hRow2.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.font = { name: "Arial", size: 7.5, italic: true, color: { argb: "FF475569" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  // Table Data Rows
  (data.items || []).forEach((item, idx) => {
    const rIdx = 10 + idx + 1;
    const dispPrice = getDisplayPrice(item, data.priceTerm, data.containerSize, data.financialParams?.cifRate);
    const imgBase64 = itemImagesBase64[idx];

    const rowVals = activeCols.map(col => {
      if (col.isImage) return "";
      return col.getVal(item, idx, dispPrice);
    });

    const dRow = ws.addRow(rowVals);
    dRow.height = 48;

    activeCols.forEach((col, cIdx) => {
      const cell = dRow.getCell(cIdx + 1);
      if (col.getFormula) {
        cell.value = { formula: col.getFormula(rIdx), result: col.getVal(item, idx, dispPrice) };
      }
      cell.font = { name: "Arial", size: 9 };
      cell.alignment = { vertical: "middle", horizontal: col.align || "center", wrapText: true };
      cell.border = { 
        top: { style: "thin", color: { argb: "FFCBD5E1" } }, 
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } }
      };

      if (col.isPrice) {
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0284C7" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFE0F2FE" } };
      }
    });

    const imgColIdx = activeCols.findIndex(c => c.isImage);
    if (imgColIdx !== -1) {
      if (imgBase64) {
        try {
          const cleanBase64 = imgBase64.replace(/^data:image\/\w+;base64,/, "");
          const imageId = workbook.addImage({
            base64: cleanBase64,
            extension: "jpeg"
          });
          ws.addImage(imageId, {
            tl: { col: imgColIdx + 0.15, row: dRow.number - 1 + 0.1 },
            ext: { width: 60, height: 48 }
          });
        } catch (imgErr) {
          dRow.getCell(imgColIdx + 1).value = "[Image]";
        }
      } else {
        dRow.getCell(imgColIdx + 1).value = "-";
      }
    }
  });

  ws.addRow([]); // Spacer

  // Notes & Commercial Terms
  const noteTitle = ws.addRow(["", "Note"]);
  noteTitle.getCell(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F172A" } };

  const lastColLetter = getColumnLetter(numCols);
  const addTermRow = (label, val) => {
    const r = ws.addRow(["", label, val]);
    r.getCell(2).font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF334155" } };
    r.getCell(3).font = { name: "Arial", size: 9.5 };
    if (numCols >= 3) {
      ws.mergeCells(`C${r.number}:${lastColLetter}${r.number}`);
    }
  };

  addTermRow("Packing", data.packing);
  addTermRow("Price term", `${data.priceTerm} (${data.containerSize} Basis)`);
  addTermRow("Payment terms", data.paymentTerms);
  addTermRow("Validity", data.validity);
  addTermRow("Utilization Lead time", data.leadTime);

  ws.addRow([]);
  const compRow = ws.addRow(["", `${data.shipper.shipperName || "Toyo Cushion Lanka"}\nCOMPANY NO : ${data.shipper.companyNo || "PV 5492"}\n${data.shipper.address || "400 Deans Road Colombo 10 01000 Sri Lanka"}\nTel: ${data.shipper.phone || "94112232939-Fixed"}`]);
  compRow.getCell(2).font = { name: "Arial", size: 8.5, color: { argb: "FF475569" } };
  compRow.getCell(2).alignment = { wrapText: true };
  const compEndCol = Math.min(numCols, Math.max(2, Math.floor(numCols / 2)));
  if (compEndCol >= 2) {
    ws.mergeCells(`B${compRow.number}:${getColumnLetter(compEndCol)}${compRow.number + 1}`);
  }

  ws.addRow([]);
  ws.addRow([]);
  const sigCol = Math.max(1, numCols - 2);
  const sigRowArr = new Array(numCols).fill("");
  sigRowArr[sigCol - 1] = "………………………….";
  const sigRow = ws.addRow(sigRowArr);
  sigRow.getCell(sigCol).font = { name: "Arial", size: 10, bold: true };

  const officerNameStr = data.shipper?.signatoryName || data.shipper?.signatory || "Manager - Sales & Marketing";
  const officerRoleStr = data.shipper?.signatoryRole || "";
  const sigTitleArr = new Array(numCols).fill("");
  sigTitleArr[sigCol - 1] = officerNameStr;
  const sigTitle = ws.addRow(sigTitleArr);
  sigTitle.getCell(sigCol).font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF334155" } };
  if (officerRoleStr) {
    const sigRoleArr = new Array(numCols).fill("");
    sigRoleArr[sigCol - 1] = officerRoleStr;
    const sigRoleRow = ws.addRow(sigRoleArr);
    sigRoleRow.getCell(sigCol).font = { name: "Arial", size: 8.5, color: { argb: "FF64748B" } };
  }
}

// --------------------------------------------------------------------------
// 2. BEDDING DATA ENTRY SHEET (SHEET 2 - WITH ACTIVE FORMULAS)
// --------------------------------------------------------------------------
function buildBeddingDataEntrySheet(workbook, data) {
  const ws = workbook.addWorksheet("Data Entry");
  ws.views = [{ showGridLines: true }];
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  // Set explicit column widths
  const colWidths = [
    26, 10, 10, 10, 16, 14, 12, 14, 14, 16, 14, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16
  ];
  colWidths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  // Banner
  const titleRow = ws.addRow(["HAYFIBRE OPERATIONS - PRODUCT COSTING SHEET"]);
  titleRow.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  titleRow.height = 28;
  titleRow.alignment = { vertical: "middle", horizontal: "center" };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  ws.mergeCells("A1:Y1");

  const p = data.financialParams || DEFAULT_FINANCIAL_PARAMS;
  const is20 = data.containerSize === "20ft";
  const is40 = data.containerSize === "40ft";

  // Row 2
  const r2 = ws.addRow([]);
  r2.getCell(18).value = "Export expence";
  r2.getCell(19).value = p.exportExpense;
  r2.getCell(21).value = "20 ft price";
  r2.getCell(22).value = is20 ? "Active" : "";
  r2.getCell(24).value = "FOB";
  r2.getCell(25).value = data.priceTerm === "FOB" ? "Active" : "";

  // Row 3
  const r3 = ws.addRow([
    "Cost Request No:", data.costRequest?.costRequestNo || "-",
    "Request Date:", data.costRequest?.requestDate ? new Date(data.costRequest.requestDate).toLocaleDateString() : "-"
  ]);
  r3.getCell(18).value = "Exhange rate";
  r3.getCell(19).value = p.exchangeRate;
  r3.getCell(21).value = "40ft price";
  r3.getCell(22).value = is40 ? "Active" : "";
  r3.getCell(24).value = "EX works";
  r3.getCell(25).value = (data.priceTerm === "EX_WORKS" || data.priceTerm === "EX works") ? "Active" : "";

  // Row 4
  const r4 = ws.addRow([
    "Customer Name:", data.buyerName,
    "Completion Date:", data.costRequest?.completionDate ? new Date(data.costRequest.completionDate).toLocaleDateString() : "-"
  ]);
  r4.getCell(18).value = "Margin";
  r4.getCell(19).value = p.margin;
  r4.getCell(19).numFmt = "0.0%";
  r4.getCell(24).value = "CIF";
  r4.getCell(25).value = data.priceTerm === "CIF" ? "Active" : "";

  // Row 5
  const r5 = ws.addRow([]);
  r5.getCell(18).value = "CIF rate";
  r5.getCell(19).value = p.cifRate;
  r5.getCell(24).value = "FOB with separate CIF";
  r5.getCell(25).value = (data.priceTerm === "FOB_SEPARATE_CIF" || data.priceTerm === "FOB with separate CIF") ? "Active" : "";

  // Row 6
  const r6 = ws.addRow([]);
  r6.getCell(18).value = "Vat";
  r6.getCell(19).value = p.vat;
  r6.getCell(19).numFmt = "0.0%";

  // Row 7 & 8
  const r7 = ws.addRow([
    "Product Category:", "Bedding",
    "Status:", data.costRequest?.status || "Costing Completed"
  ]);
  const mktOfficerName = data.shipper?.signatoryName || data.costRequest?.marketingOfficer?.name || "-";
  const r8 = ws.addRow([
    "Marketing Officer:", mktOfficerName,
    "Finance Officer:", data.costRequest?.financeOfficer?.name || "-"
  ]);

  [r2, r3, r4, r5, r6, r7, r8].forEach(row => {
    row.eachCell((cell, col) => {
      cell.font = { name: "Arial", size: 9 };
      if ([1, 3, 18, 21, 24].includes(col)) cell.font = { name: "Arial", size: 9, bold: true };
    });
  });

  ws.addRow([]); // Spacer

  // Data Entry Headers (Row 10)
  const headers = [
    "Description",
    "L (CM)",
    "W (CM)",
    "H (CM)",
    "Organic/Non Org",
    "NC/RC Ratio",
    "Density",
    "Qty/BUNDLE",
    "Pallet size",
    "Bundles per pallet",
    "Unit Cost (Fin)",
    "No of pallets per 40ft",
    "No of pallets per 20ft",
    "Bundles per 20ft",
    "Bundles per 40ft",
    "Qty per 40ft",
    "Qty per 20ft",
    "FOB price (40ft)",
    "FOB price (20ft)",
    "CIF price for 40ft",
    "CIF price for 20ft",
    "Ex work price"
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0284C7" } };
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  // Rows with active formulas
  (data.items || []).forEach((item, idx) => {
    const rIdx = headerRow.number + 1 + idx;
    const isPallet = (item.bundlesPerPallet > 0) && (item.palletsPer40ft > 0 || item.palletsPer20ft > 0);

    const dRow = ws.addRow([
      item.description || item.specifications || `Item ${idx + 1}`,
      item.length || 0,
      item.width || 0,
      item.height || 0,
      item.organic || "Non-Organic",
      item.ncRcRatio || "-",
      item.density || "-",
      item.qtyPerBundle || 1,
      item.palletSize || "TBA",
      item.bundlesPerPallet || 0,
      item.unitCost || 0,
      item.palletsPer40ft || 0,
      item.palletsPer20ft || 0
    ]);

    dRow.height = 22;

    // Active formulas
    if (isPallet) {
      dRow.getCell(14).value = { formula: `M${rIdx}*J${rIdx}`, result: item.bundlesPer20ft };
      dRow.getCell(15).value = { formula: `L${rIdx}*J${rIdx}`, result: item.bundlesPer40ft };
      dRow.getCell(16).value = { formula: `L${rIdx}*J${rIdx}*H${rIdx}`, result: item.qtyPer40ft };
      dRow.getCell(17).value = { formula: `M${rIdx}*J${rIdx}*H${rIdx}`, result: item.qtyPer20ft };
    } else {
      dRow.getCell(14).value = { formula: `26/((B${rIdx}*C${rIdx}*D${rIdx})/1000000)/H${rIdx}`, result: item.bundlesPer20ft };
      dRow.getCell(15).value = { formula: `66/((B${rIdx}*C${rIdx}*D${rIdx})/1000000)/H${rIdx}`, result: item.bundlesPer40ft };
      dRow.getCell(16).value = { formula: `O${rIdx}*H${rIdx}`, result: item.qtyPer40ft };
      dRow.getCell(17).value = { formula: `N${rIdx}*H${rIdx}`, result: item.qtyPer20ft };
    }

    // Pricing formulas
    dRow.getCell(18).value = { formula: `((($S$2/P${rIdx}+K${rIdx})/$S$3))/(1-$S$4)`, result: item.fobPrice40ft };
    dRow.getCell(19).value = { formula: `((($S$2/Q${rIdx}+K${rIdx})/$S$3))/(1-$S$4)`, result: item.fobPrice20ft };
    dRow.getCell(20).value = { formula: `R${rIdx}+($S$5/P${rIdx})`, result: item.cifPrice40ft };
    dRow.getCell(21).value = { formula: `S${rIdx}+($S$5/Q${rIdx})`, result: item.cifPrice20ft };
    dRow.getCell(22).value = { formula: `((K${rIdx}/($S$4)*(1+$S$6)))`, result: item.exWorksPrice };

    dRow.eachCell((cell, colIdx) => {
      cell.font = { name: "Arial", size: 9 };
      cell.alignment = { vertical: "middle", horizontal: colIdx === 1 ? "left" : "center" };
      cell.border = { top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };

      if ([18, 19, 20, 21].includes(colIdx)) {
        cell.numFmt = "$#,##0.0000";
      } else if (colIdx === 22) {
        cell.numFmt = "#,##0.00";
      } else if ([16, 17].includes(colIdx)) {
        cell.numFmt = "#,##0";
      }
    });
  });

  // Bottom Special Packing & Loading Calculation Modes Guide (Exact match of Excel)
  ws.addRow([]); // Blank spacer
  const guideTitleB = ws.addRow(["Special Packing & Loading Calculation Modes (as embedded in Excel):"]);
  guideTitleB.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
  const gb1 = ws.addRow(["In a situation of bundles with pallet loading:"]);
  gb1.font = { name: "Arial", size: 9, bold: true, color: { argb: "FF0284C7" } };
  const gb2 = ws.addRow(["• Bundles per 20ft: No required"]);
  const gb3 = ws.addRow(["• Qty per 40ft = Auto cal =(L x J x H)  |  Qty per 20ft = Auto cal =(M x J x H)"]);
  const gb4 = ws.addRow(["• Pricing equations: FOB, CIF, EXW apply uniformly across container selection modes"]);
  [gb2, gb3, gb4].forEach(r => {
    r.font = { name: "Arial", size: 8.5, color: { argb: "FF475569" } };
  });
}

// --------------------------------------------------------------------------
// 3. HORTICULTURE QUOTATION SHEET (SHEET 3)
// --------------------------------------------------------------------------
function buildHortiQuotationSheet(workbook, data, itemImagesBase64 = []) {
  const ws = workbook.addWorksheet("Quotation Format");
  ws.views = [{ showGridLines: true }];
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const MASTER_HORTI_COLS = [
    { key: "idx", dataKey: "idx", header1: "#", header2: "#", width: 5, align: "center", getVal: (item, idx) => idx + 1 },
    { key: "imageUrl", dataKey: "imageUrl", header1: "Image", header2: "Images common", width: 16, align: "center", isImage: true },
    { key: "description", dataKey: "description", header1: "Product spec", header2: "As per cost req data", width: 38, align: "left", getVal: (item, idx) => item.description || item.specifications || `Item #${idx + 1}` },
    { key: "packing", dataKey: "packing", header1: "Packing (Pcs / Ctn or Bdl)", header2: "AS per cost req", width: 16, align: "center", getVal: (item) => item.packing || 1 },
    { key: "cartonSize", dataKey: "cartonSize", header1: "Carton / Bundle Size CM", header2: "100X100X50 (As per req)", width: 18, align: "center", getVal: (item) => item.cartonSize || "57X51X58CM" },
    { key: "palletSize", dataKey: "palletSize", header1: "Pallet size", header2: "If applicable", width: 14, align: "center", getVal: (item) => item.palletSize || "TBA" },
    { key: "cartonsPerPallet", dataKey: "cartonsPerPallet", header1: "Cartons / Bundles per Pallet", header2: "AS per cost req", width: 16, align: "center", getVal: (item) => item.cartonsPerPallet || 0 },
    { key: "palletsPer20ft", dataKey: "palletsPer20ft", header1: "Pallets per 20ft", header2: "Marketing to fill", width: 16, align: "center", getVal: (item) => item.palletsPer20ft || 0 },
    { key: "palletsPer40ft", dataKey: "palletsPer40ft", header1: "Pallets per 40ft", header2: "Marketing to fill", width: 16, align: "center", getVal: (item) => item.palletsPer40ft || 0 },
    { key: "rollDiameter", dataKey: "rollDiameter", header1: "Roll diameter (If Roll)", header2: "If applicable", width: 16, align: "center", getVal: (item) => item.rollDiameter || "-" },
    { key: "quotedPrice", dataKey: "quotedPrice", header1: "Price FOB /cif/Ex works", header2: "Auto calculated price", width: 22, align: "center", isPrice: true, getFormula: (rIdx) => `'Data Entry'!R${rIdx}`, getVal: (item, idx, dispPrice) => dispPrice.label },
    { key: "cartonsPer20ft", dataKey: "cartonsPer20ft", header1: "Cartons / Bundles per 20ft", header2: "Auto pick", width: 16, align: "center", getFormula: (rIdx) => `'Data Entry'!N${rIdx}`, getVal: (item) => item.cartonsPer20ft || 0 },
    { key: "qtyPer20ft", dataKey: "qtyPer20ft", header1: "Qty per 20ft", header2: "Auto pick", width: 16, align: "center", getFormula: (rIdx) => `'Data Entry'!O${rIdx}`, getVal: (item) => item.qtyPer20ft || 0 },
    { key: "cartonsPer40ft", dataKey: "cartonsPer40ft", header1: "Cartons / Bundles per 40ft", header2: "Auto pick", width: 16, align: "center", getFormula: (rIdx) => `'Data Entry'!P${rIdx}`, getVal: (item) => item.cartonsPer40ft || 0 },
    { key: "qtyPer40ft", dataKey: "qtyPer40ft", header1: "Qty per 40ft", header2: "Auto pick", width: 16, align: "center", getFormula: (rIdx) => `'Data Entry'!Q${rIdx}`, getVal: (item) => item.qtyPer40ft || 0 }
  ];

  // Filter columns based strictly on unchecked / selected columns
  const selected = data.selectedColumns;
  let activeCols = MASTER_HORTI_COLS;
  if (Array.isArray(selected) && selected.length > 0) {
    activeCols = MASTER_HORTI_COLS.filter(c => selected.includes(c.dataKey) || selected.includes(c.key));
  }
  if (activeCols.length === 0) activeCols = MASTER_HORTI_COLS;
  const numCols = activeCols.length;

  activeCols.forEach((col, idx) => {
    ws.getColumn(idx + 1).width = col.width;
  });

  // Row 1: Blank
  ws.addRow([]);

  // Row 2: Title & Ref No
  const r2 = ws.addRow([]);
  r2.height = 28;
  const titleCol = Math.min(3, Math.max(1, Math.floor(numCols / 2)));
  r2.getCell(titleCol).value = "Price Quotation";
  r2.getCell(titleCol).font = { name: "Arial", size: 16, bold: true, color: { argb: "FF1E3A8A" } };
  r2.getCell(titleCol).alignment = { vertical: "middle" };

  const refLabelCol = Math.max(titleCol + 1, numCols - 1);
  const refValCol = numCols;
  r2.getCell(refLabelCol).value = "Quotation ref number :";
  r2.getCell(refLabelCol).font = { name: "Arial", size: 9.5, bold: true };
  r2.getCell(refLabelCol).alignment = { vertical: "middle", horizontal: "right" };
  r2.getCell(refValCol).value = data.quotationNo;
  r2.getCell(refValCol).font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF0284C7" } };
  r2.getCell(refValCol).alignment = { vertical: "middle", horizontal: "left" };

  // Row 3: Blank
  ws.addRow([]);

  // Row 4: Date
  const r4 = ws.addRow([]);
  r4.getCell(refLabelCol).value = "Date :";
  r4.getCell(refLabelCol).font = { name: "Arial", size: 9.5, bold: true };
  r4.getCell(refLabelCol).alignment = { vertical: "middle", horizontal: "right" };
  r4.getCell(refValCol).value = data.quotationDate;
  r4.getCell(refValCol).font = { name: "Arial", size: 9.5 };
  r4.getCell(refValCol).alignment = { vertical: "middle", horizontal: "left" };

  // Row 5: Blank
  ws.addRow([]);

  // Row 6: Shipper & Buyer
  const r6 = ws.addRow([]);
  const splitMid = Math.max(2, Math.floor(numCols / 2));

  r6.getCell(2).value = "Shipper :";
  r6.getCell(2).font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF1E3A8A" } };
  r6.getCell(3).value = `${data.shipper.shipperName || "Toyo Cushion Lanka"}\nCOMPANY NO : ${data.shipper.companyNo || "PV 5492"}\n${data.shipper.address || "400 Deans Road Colombo 10 01000 Sri Lanka"}\nTel: ${data.shipper.phone || "94112232939-Fixed"}`;
  r6.getCell(3).font = { name: "Arial", size: 8.5 };
  r6.getCell(3).alignment = { wrapText: true, vertical: "top" };
  if (splitMid >= 3) {
    ws.mergeCells(`C6:${getColumnLetter(splitMid)}7`);
  }

  const buyerStartCol = splitMid + 1;
  if (buyerStartCol <= numCols) {
    r6.getCell(buyerStartCol).value = "Buyer :";
    r6.getCell(buyerStartCol).font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF1E3A8A" } };
    const buyerValCol = buyerStartCol + 1 <= numCols ? buyerStartCol + 1 : buyerStartCol;
    r6.getCell(buyerValCol).value = `${data.buyerName}\nCategory: HORTICULTURE | Pricing Term: ${data.priceTerm} (${data.containerSize} Container)`;
    r6.getCell(buyerValCol).font = { name: "Arial", size: 9, bold: true };
    r6.getCell(buyerValCol).alignment = { wrapText: true, vertical: "top" };
    if (numCols >= buyerValCol) {
      ws.mergeCells(`${getColumnLetter(buyerValCol)}6:${getColumnLetter(numCols)}7`);
    }
  }

  ws.addRow([]); // Row 7 merged spacer
  ws.addRow([]); // Row 8 blank spacer

  // Row 9: 2-Tier Header 1
  const hRow1 = ws.addRow(activeCols.map(c => c.header1));
  hRow1.height = 24;
  hRow1.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  // Row 10: 2-Tier Header 2
  const hRow2 = ws.addRow(activeCols.map(c => c.header2));
  hRow2.height = 20;
  hRow2.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
    cell.font = { name: "Arial", size: 7.5, italic: true, color: { argb: "FF475569" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  (data.items || []).forEach((item, idx) => {
    const rIdx = 10 + idx + 1;
    const dispPrice = getDisplayPrice(item, data.priceTerm, data.containerSize, data.financialParams?.cifRate);
    const imgBase64 = itemImagesBase64[idx];

    const rowVals = activeCols.map(col => {
      if (col.isImage) return "";
      return col.getVal(item, idx, dispPrice);
    });

    const dRow = ws.addRow(rowVals);
    dRow.height = 48; // Ample height for thumbnail image

    activeCols.forEach((col, cIdx) => {
      const cell = dRow.getCell(cIdx + 1);
      if (col.getFormula) {
        cell.value = { formula: col.getFormula(rIdx), result: col.getVal(item, idx, dispPrice) };
      }
      cell.font = { name: "Arial", size: 9 };
      cell.alignment = { vertical: "middle", horizontal: col.align || "center", wrapText: true };
      cell.border = { 
        top: { style: "thin", color: { argb: "FFCBD5E1" } }, 
        bottom: { style: "thin", color: { argb: "FFCBD5E1" } },
        left: { style: "thin", color: { argb: "FFCBD5E1" } },
        right: { style: "thin", color: { argb: "FFCBD5E1" } }
      };

      if (col.isPrice) {
        cell.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF059669" } };
        cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFD1FAE5" } };
      }
    });

    // Embed Image into Column B if visible
    const imgColIdx = activeCols.findIndex(c => c.isImage);
    if (imgColIdx !== -1) {
      if (imgBase64) {
        try {
          const cleanBase64 = imgBase64.replace(/^data:image\/\w+;base64,/, "");
          const imageId = workbook.addImage({
            base64: cleanBase64,
            extension: "jpeg"
          });
          ws.addImage(imageId, {
            tl: { col: imgColIdx + 0.15, row: dRow.number - 1 + 0.1 },
            ext: { width: 60, height: 48 }
          });
        } catch (imgErr) {
          dRow.getCell(imgColIdx + 1).value = "[Image]";
        }
      } else {
        dRow.getCell(imgColIdx + 1).value = "-";
      }
    }
  });

  ws.addRow([]); // Spacer

  const noteTitle = ws.addRow(["", "Note"]);
  noteTitle.getCell(2).font = { name: "Arial", size: 11, bold: true, color: { argb: "FF0F172A" } };

  const lastColLetter = getColumnLetter(numCols);
  const addTermRow = (label, val) => {
    const r = ws.addRow(["", label, val]);
    r.getCell(2).font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF334155" } };
    r.getCell(3).font = { name: "Arial", size: 9.5 };
    if (numCols >= 3) {
      ws.mergeCells(`C${r.number}:${lastColLetter}${r.number}`);
    }
  };

  addTermRow("Packing", data.packing);
  addTermRow("Price term", `${data.priceTerm} (${data.containerSize} Basis)`);
  addTermRow("Payment terms", data.paymentTerms);
  addTermRow("Validity", data.validity);
  addTermRow("Utilization Lead time", data.leadTime);

  ws.addRow([]);
  const compRowH = ws.addRow(["", `${data.shipper.shipperName || "Toyo Cushion Lanka"}\nCOMPANY NO : ${data.shipper.companyNo || "PV 5492"}\n${data.shipper.address || "400 Deans Road Colombo 10 01000 Sri Lanka"}\nTel: ${data.shipper.phone || "94112232939-Fixed"}`]);
  compRowH.getCell(2).font = { name: "Arial", size: 8.5, color: { argb: "FF475569" } };
  compRowH.getCell(2).alignment = { wrapText: true };
  const compEndCol = Math.min(numCols, Math.max(2, Math.floor(numCols / 2)));
  if (compEndCol >= 2) {
    ws.mergeCells(`B${compRowH.number}:${getColumnLetter(compEndCol)}${compRowH.number + 1}`);
  }

  ws.addRow([]);
  ws.addRow([]);
  const sigColH = Math.max(1, numCols - 2);
  const sigRowArr = new Array(numCols).fill("");
  sigRowArr[sigColH - 1] = "………………………….";
  const sigRowH = ws.addRow(sigRowArr);
  sigRowH.getCell(sigColH).font = { name: "Arial", size: 10, bold: true };

  const officerNameStrH = data.shipper?.signatoryName || data.shipper?.signatory || "Manager - Sales & Marketing";
  const officerRoleStrH = data.shipper?.signatoryRole || "";
  const sigTitleArrH = new Array(numCols).fill("");
  sigTitleArrH[sigColH - 1] = officerNameStrH;
  const sigTitleH = ws.addRow(sigTitleArrH);
  sigTitleH.getCell(sigColH).font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF334155" } };
  if (officerRoleStrH) {
    const sigRoleRowH = ws.addRow(["", "", "", "", "", "", "", "", "", "", "", "", officerRoleStrH]);
    sigRoleRowH.getCell(sigColH).font = { name: "Arial", size: 8.5, color: { argb: "FF64748B" } };
  }
}

// --------------------------------------------------------------------------
// 4. HORTICULTURE DATA ENTRY SHEET (SHEET 4 - WITH ACTIVE FORMULAS)
// --------------------------------------------------------------------------
function buildHortiDataEntrySheet(workbook, data) {
  const ws = workbook.addWorksheet("Data Entry");
  ws.views = [{ showGridLines: true }];
  ws.pageSetup = { orientation: "landscape", paperSize: 9, fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

  const colWidths = [
    6, 22, 30, 10, 14, 14, 16, 14, 16, 14, 14, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16, 16
  ];
  colWidths.forEach((w, idx) => {
    ws.getColumn(idx + 1).width = w;
  });

  const titleRow = ws.addRow(["HAYFIBRE OPERATIONS - PRODUCT COSTING SHEET"]);
  titleRow.font = { name: "Arial", size: 13, bold: true, color: { argb: "FFFFFFFF" } };
  titleRow.height = 28;
  titleRow.alignment = { vertical: "middle", horizontal: "center" };
  titleRow.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF0F172A" } };
  ws.mergeCells("A1:Y1");

  const p = data.financialParams || DEFAULT_FINANCIAL_PARAMS;
  const is20 = data.containerSize === "20ft";
  const is40 = data.containerSize === "40ft";

  const r2 = ws.addRow([]);
  r2.getCell(18).value = "Export expence";
  r2.getCell(19).value = p.exportExpense;
  r2.getCell(21).value = "20 ft price";
  r2.getCell(22).value = is20 ? "Active" : "";
  r2.getCell(24).value = "FOB";
  r2.getCell(25).value = data.priceTerm === "FOB" ? "Active" : "";

  const r3 = ws.addRow([
    "Cost Request No:", data.costRequest?.costRequestNo || "-",
    "Request Date:", data.costRequest?.requestDate ? new Date(data.costRequest.requestDate).toLocaleDateString() : "-"
  ]);
  r3.getCell(18).value = "Exhange rate";
  r3.getCell(19).value = p.exchangeRate;
  r3.getCell(21).value = "40ft price";
  r3.getCell(22).value = is40 ? "Active" : "";
  r3.getCell(24).value = "EX works";
  r3.getCell(25).value = (data.priceTerm === "EX_WORKS" || data.priceTerm === "EX works") ? "Active" : "";

  const r4 = ws.addRow([
    "Customer Name:", data.buyerName,
    "Completion Date:", data.costRequest?.completionDate ? new Date(data.costRequest.completionDate).toLocaleDateString() : "-"
  ]);
  r4.getCell(18).value = "Margin";
  r4.getCell(19).value = p.margin;
  r4.getCell(19).numFmt = "0.0%";
  r4.getCell(24).value = "CIF";
  r4.getCell(25).value = data.priceTerm === "CIF" ? "Active" : "";

  const r5 = ws.addRow([]);
  r5.getCell(18).value = "CIF rate";
  r5.getCell(19).value = p.cifRate;
  r5.getCell(24).value = "FOB with separate CIF";
  r5.getCell(25).value = (data.priceTerm === "FOB_SEPARATE_CIF" || data.priceTerm === "FOB with separate CIF") ? "Active" : "";

  const r6 = ws.addRow([]);
  r6.getCell(18).value = "Vat";
  r6.getCell(19).value = p.vat;
  r6.getCell(19).numFmt = "0.0%";

  const r7 = ws.addRow([
    "Product Category:", "Horticulture",
    "Status:", data.costRequest?.status || "Costing Completed"
  ]);
  const mktOfficerNameH = data.shipper?.signatoryName || data.costRequest?.marketingOfficer?.name || "-";
  const r8 = ws.addRow([
    "Marketing Officer:", mktOfficerNameH,
    "Finance Officer:", data.costRequest?.financeOfficer?.name || "-"
  ]);

  [r2, r3, r4, r5, r6, r7, r8].forEach(row => {
    row.eachCell((cell, col) => {
      cell.font = { name: "Arial", size: 9 };
      if ([1, 3, 18, 21, 24].includes(col)) cell.font = { name: "Arial", size: 9, bold: true };
    });
  });

  ws.addRow([]); // Spacer

  const headers = [
    "Item #",
    "Product Description (Mkt)",
    "Product Specifications (Mkt)",
    "GSM (Mkt)",
    "Latex Ratio (Mkt)",
    "Packing - Pieces per Carton or Bundle (Fin)",
    "Carton / Bundle Size (CM) (Fin)",
    "Pallet size-Optional",
    "Cartons / Bundles per Pallet-Optional",
    "Roll diameter-Optional",
    "Unit Cost (Fin)",
    "No of pallets per 40ft",
    "No of pallets per 20ft",
    "Cartons / Bundles per 20ft",
    "Cartons / Bundles per 40ft",
    "Qty per 40ft",
    "Qty per 20ft",
    "FOB price-If Fob is ticked with 40ft price",
    "FOB price-If Fob is ticked with 20ft price",
    "CIF price for 40ft price",
    "CIF price for 20ft price",
    "Ex work price"
  ];

  const headerRow = ws.addRow(headers);
  headerRow.height = 28;
  headerRow.eachCell((cell) => {
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF059669" } };
    cell.font = { name: "Arial", size: 9, bold: true, color: { argb: "FFFFFFFF" } };
    cell.alignment = { vertical: "middle", horizontal: "center", wrapText: true };
    cell.border = { top: { style: "thin" }, bottom: { style: "medium" }, left: { style: "thin" }, right: { style: "thin" } };
  });

  (data.items || []).forEach((item, idx) => {
    const rIdx = headerRow.number + 1 + idx;
    const isPallet = item.loadingType === "pallet" && item.cartonsPerPallet > 0;
    const isRoll = item.loadingType === "roll" || Boolean(item.rollDiameter && item.rollDiameter !== "TBA" && item.rollDiameter !== "-" && String(item.rollDiameter).trim() !== "");
    const dims = item.dims || { length: 57, width: 51, height: 58 };

    const dRow = ws.addRow([
      idx + 1,
      item.description || "-",
      item.specifications || "-",
      item.gsm || "-",
      item.latexRatio || "-",
      item.packing || 1,
      item.cartonSize || "-",
      item.palletSize || "TBA",
      item.cartonsPerPallet || 0,
      item.rollDiameter || "TBA",
      item.unitCost || 0,
      item.palletsPer40ft || 0,
      item.palletsPer20ft || 0
    ]);

    dRow.height = 22;

    if (isPallet) {
      dRow.getCell(14).value = { formula: `M${rIdx}*I${rIdx}`, result: item.cartonsPer20ft };
      dRow.getCell(15).value = { formula: `L${rIdx}*I${rIdx}`, result: item.cartonsPer40ft };
      dRow.getCell(16).value = { formula: `L${rIdx}*I${rIdx}*F${rIdx}`, result: item.qtyPer40ft };
      dRow.getCell(17).value = { formula: `M${rIdx}*I${rIdx}*F${rIdx}`, result: item.qtyPer20ft };
    } else if (isRoll) {
      dRow.getCell(14).value = item.cartonsPer20ft || item.bundlesPer20ft || 0;
      dRow.getCell(15).value = item.cartonsPer40ft || item.bundlesPer40ft || 0;
      dRow.getCell(16).value = item.qtyPer40ft || 0;
      dRow.getCell(17).value = item.qtyPer20ft || 0;
    } else {
      const volFormula = `(${dims.length || 57}*${dims.width || 51}*${dims.height || 58})/1000000`;
      dRow.getCell(14).value = { formula: `26/(${volFormula})`, result: item.cartonsPer20ft };
      dRow.getCell(15).value = { formula: `66/(${volFormula})-7`, result: item.cartonsPer40ft };
      dRow.getCell(16).value = { formula: `+O${rIdx}*F${rIdx}`, result: item.qtyPer40ft };
      dRow.getCell(17).value = { formula: `+N${rIdx}*F${rIdx}`, result: item.qtyPer20ft };
    }

    // Pricing formulas
    dRow.getCell(18).value = { formula: `((($S$2/P${rIdx}+K${rIdx})/$S$3))/(1-$S$4)`, result: item.fobPrice40ft };
    dRow.getCell(19).value = { formula: `((($S$2/Q${rIdx}+K${rIdx})/$S$3))/(1-$S$4)`, result: item.fobPrice20ft };
    dRow.getCell(20).value = { formula: `R${rIdx}+($S$5/P${rIdx})`, result: item.cifPrice40ft };
    dRow.getCell(21).value = { formula: `S${rIdx}+($S$5/Q${rIdx})`, result: item.cifPrice20ft };
    dRow.getCell(22).value = { formula: `((K${rIdx}/($S$4)*(1+$S$6)))`, result: item.exWorksPrice };

    dRow.eachCell((cell, colIdx) => {
      cell.font = { name: "Arial", size: 9 };
      cell.alignment = { vertical: "middle", horizontal: colIdx === 2 || colIdx === 3 ? "left" : "center" };
      cell.border = { top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } } };

      if ([18, 19, 20, 21].includes(colIdx)) {
        cell.numFmt = "$#,##0.0000";
      } else if (colIdx === 22) {
        cell.numFmt = "#,##0.00";
      } else if ([16, 17].includes(colIdx)) {
        cell.numFmt = "#,##0";
      }
    });
  });

  // Bottom Special Packing & Loading Calculation Modes Guide (Exact match of Excel)
  ws.addRow([]); // Blank spacer
  const guideTitleH = ws.addRow(["Special Packing & Loading Calculation Modes (as embedded in Excel):"]);
  guideTitleH.font = { name: "Arial", size: 10, bold: true, color: { argb: "FF0F172A" } };
  const gh1 = ws.addRow(["1. In a situation of no cartons & bundle floor loaded: Pallets 40ft / 20ft: Manual entry | Cartons/Bundles 20ft = Auto cal (O x F) | Cartons/Bundles 40ft = Auto cal (N x F) | Qty = SAME"]);
  const gh2 = ws.addRow(["2. In a situation of cartons/bundles with pallet loading: Pallets: No required | Cartons/Bundles 20ft = Auto cal =(L x I x F) | Cartons/Bundles 40ft = Auto cal =(M x I x F) | Qty = SAME"]);
  const gh3 = ws.addRow(["3. In a situation of Roll form loading: Pallets: No required | Cartons/Bundles 20ft / 40ft = Manual entry | Qty = SAME"]);
  [gh1, gh2, gh3].forEach(r => {
    r.font = { name: "Arial", size: 8.5, color: { argb: "FF475569" } };
  });
}
