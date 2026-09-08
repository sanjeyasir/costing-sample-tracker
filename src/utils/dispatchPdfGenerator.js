import { jsPDF } from "jspdf";
import logoUrl from "../assets/hayleys-fibre-log.jpg";
import emblemUrl from "../assets/sri-lanka-emblem.png";
import { calculateDispatchTotals } from "./dispatchCalculations";

/**
 * Loads an image URL/Base64 asynchronously and returns its Base64 data URL.
 */
const loadImageBase64 = (url) => {
  if (!url) return Promise.resolve(null);
  if (typeof url === "string" && url.startsWith("data:image/")) {
    return Promise.resolve(url);
  }
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      try {
        const canvas = document.createElement("canvas");
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);
        const dataURL = canvas.toDataURL("image/png");
        resolve(dataURL);
      } catch (err) {
        console.warn("Canvas conversion error:", err);
        resolve(null);
      }
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
  });
};

/**
 * 1. Generates Commercial / Sample Invoice PDF
 * Solid Black & White, high precision alignment, explicit text wrapping
 */
export async function generateSampleInvoicePDF(dispatchData, docInstance = null) {
  const doc = docInstance || new jsPDF("p", "mm", "a4");
  const totals = calculateDispatchTotals(dispatchData);
  const currency = dispatchData.receiver?.currency || "USD";

  const margin = 10;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = 190;
  const rightEdge = margin + contentWidth;

  // Outer Border
  doc.setLineWidth(0.4);
  doc.setDrawColor(0, 0, 0);
  doc.rect(margin, margin, contentWidth, pageHeight - 2 * margin);

  // Logo (Left)
  const logoBase64 = await loadImageBase64(logoUrl);
  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", margin + 2, margin + 2, 42, 14);
  }

  // Header Title & Address (Centered between logo and right edge)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.setTextColor(0, 0, 0);
  doc.text(dispatchData.sender?.companyName || "TOYO CUSHION LANKA (PVT) LTD", 125, margin + 5, { align: "center" });

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text(dispatchData.sender?.companyAddress || "No. 25, Foster Lane, Colombo 10, Sri Lanka.", 125, margin + 9.5, { align: "center" });
  doc.text(`Tel: ${dispatchData.sender?.contact || "+9474 216 8231"}  |  Email: ${dispatchData.sender?.email || "info@hayleysfibre.com"}`, 125, margin + 13.5, { align: "center" });

  // Document Title Banner
  const titleY = margin + 17;
  doc.line(margin, titleY, rightEdge, titleY);
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, titleY, contentWidth, 6.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.text("COMMERCIAL / SAMPLE INVOICE", 105, titleY + 4.5, { align: "center" });
  doc.line(margin, titleY + 6.5, rightEdge, titleY + 6.5);

  // Metadata Grid (3 Columns, 3 Rows)
  let y = titleY + 8;
  const metaH = 17;
  const col1X = margin;
  const col2X = margin + 65;
  const col3X = margin + 128;

  doc.setLineWidth(0.25);
  doc.rect(margin, y, contentWidth, metaH);
  doc.line(col2X, y, col2X, y + metaH);
  doc.line(col3X, y, col3X, y + metaH);
  doc.line(margin, y + 5.6, rightEdge, y + 5.6);
  doc.line(margin, y + 11.2, rightEdge, y + 11.2);

  doc.setFontSize(7.5);

  // Row 1
  doc.setFont("helvetica", "bold");
  doc.text("Invoice No:", col1X + 2, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.dispatchNo || "DSP-" + new Date().getFullYear(), col1X + 22, y + 4);

  doc.setFont("helvetica", "bold");
  doc.text("No. of Pieces:", col2X + 2, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(`${totals.totalQty} pcs`, col2X + 26, y + 4);

  doc.setFont("helvetica", "bold");
  doc.text("Currency:", col3X + 2, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(currency, col3X + 20, y + 4);

  // Row 2
  doc.setFont("helvetica", "bold");
  doc.text("Shipping Date:", col1X + 2, y + 9.5);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.shippingDate || new Date().toISOString().split("T")[0], col1X + 24, y + 9.5);

  doc.setFont("helvetica", "bold");
  doc.text("Net Weight:", col2X + 2, y + 9.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${totals.totalNetWeight} Kg`, col2X + 22, y + 9.5);

  doc.setFont("helvetica", "bold");
  doc.text("VAT Number:", col3X + 2, y + 9.5);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.vatNo || "114059196-7000", col3X + 24, y + 9.5);

  // Row 3
  doc.setFont("helvetica", "bold");
  doc.text("Waybill / AWB:", col1X + 2, y + 15);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.waybillNo || "N/A", col1X + 26, y + 15);

  doc.setFont("helvetica", "bold");
  doc.text("Gross Weight:", col2X + 2, y + 15);
  doc.setFont("helvetica", "normal");
  doc.text(`${totals.totalGrossWeight} Kg`, col2X + 24, y + 15);

  doc.setFont("helvetica", "bold");
  doc.text("Total Boxes:", col3X + 2, y + 15);
  doc.setFont("helvetica", "normal");
  doc.text(`${totals.noOfBoxes} Box(es)`, col3X + 24, y + 15);

  // Reason for Export Box
  y += metaH + 2;
  const reasonText = dispatchData.reasonForExport || "Samples, as per customer request. Free of charge samples of no commercial value.";
  const reasonLines = doc.splitTextToSize(reasonText, contentWidth - 42);
  const reasonH = Math.max(6, reasonLines.length * 3.5 + 2.5);

  doc.setFillColor(250, 250, 250);
  doc.rect(margin, y, contentWidth, reasonH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("REASON FOR EXPORT:", margin + 2, y + 4.2);
  doc.setFont("helvetica", "normal");
  doc.text(reasonLines, margin + 40, y + 4.2);

  // 2-Column Shipper vs Consignee
  y += reasonH + 2;
  const halfW = contentWidth / 2;
  const colRightX = margin + halfW;
  const partyBoxH = 27;

  // Column Headers
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, halfW, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("SHIPPER / EXPORTER", margin + 2, y + 3.6);

  doc.rect(colRightX, y, halfW, 5, "FD");
  doc.text("SHIP TO / CONSIGNEE", colRightX + 2, y + 3.6);

  // Shipper Content
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, y + 5, halfW, partyBoxH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(dispatchData.sender?.name || "Manura Mohotti", margin + 2, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const senderLines = doc.splitTextToSize(dispatchData.sender?.address || "", halfW - 4);
  doc.text(senderLines.slice(0, 3), margin + 2, y + 13);
  doc.text(`Tel: ${dispatchData.sender?.contact || "N/A"}  |  Email: ${dispatchData.sender?.email || "N/A"}`, margin + 2, y + 29);

  // Consignee Content
  doc.rect(colRightX, y + 5, halfW, partyBoxH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(dispatchData.receiver?.name || "", colRightX + 2, y + 9);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const recvLines = doc.splitTextToSize(dispatchData.receiver?.address || "", halfW - 4);
  doc.text(recvLines.slice(0, 3), colRightX + 2, y + 13);
  doc.text(`Country: ${dispatchData.receiver?.country || "N/A"}  |  Tel: ${dispatchData.receiver?.contact || "N/A"}`, colRightX + 2, y + 29);

  // SOO Declaration Notice
  y += partyBoxH + 7;
  const sooText = "SOO : The exporter TOYO CUSHION LANKA(PVT)LTD, 400 DEANS ROAD, COLOMBO- 10, SRI LANKA - LKREX114059196DC0155 dated 23/07/2018 of the products covered by this document declares that, except where otherwise clearly indicated, these products are of SRI LANKA preferential origin according to rules of origin of Generalized System of Preferences of European Community ('P').";
  const sooLines = doc.splitTextToSize(sooText, contentWidth - 4);
  const sooH = sooLines.length * 3 + 3;

  doc.setFillColor(250, 250, 250);
  doc.rect(margin, y, contentWidth, sooH, "FD");
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.text(sooLines, margin + 2, y + 3.2);

  // Items Table Header
  y += sooH + 2;
  const thH = 5.5;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, thH, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);

  doc.text("No.", margin + 2, y + 3.8);
  doc.text("Item / Description", margin + 10, y + 3.8);
  doc.text("QTY", 116, y + 3.8, { align: "right" });
  doc.text(`Unit Price (${currency})`, 146, y + 3.8, { align: "right" });
  doc.text("Net Wt (Kg)", 170, y + 3.8, { align: "right" });
  doc.text(`Total (${currency})`, rightEdge - 2, y + 3.8, { align: "right" });

  // Items Rows
  y += thH;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  totals.computedItems.forEach((item, idx) => {
    const descLines = doc.splitTextToSize(item.description || "", 80);
    const rowH = Math.max(5.2, descLines.length * 3.2 + 2);

    doc.rect(margin, y, contentWidth, rowH);
    doc.text(String(idx + 1), margin + 2, y + 3.6);
    doc.text(descLines, margin + 10, y + 3.6);
    doc.text(String(item.qty), 116, y + 3.6, { align: "right" });
    doc.text(Number(item.unitPrice).toFixed(2), 146, y + 3.6, { align: "right" });
    doc.text(Number(item.weightKg).toFixed(1), 170, y + 3.6, { align: "right" });
    doc.text(Number(item.lineTotal).toFixed(2), rightEdge - 2, y + 3.6, { align: "right" });

    y += rowH;
  });

  // Totals Section
  const totBoxH = 19;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, totBoxH, "FD");
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");

  doc.text("Total Cargo Weight / Value:", margin + 3, y + 4.2);
  doc.text(`${totals.totalNetWeight} Kg`, 170, y + 4.2, { align: "right" });
  doc.text(`${currency} ${totals.cargoValue.toFixed(2)}`, rightEdge - 2, y + 4.2, { align: "right" });

  doc.text("Total Gross Weight (incl packaging):", margin + 3, y + 8.4);
  doc.text(`${totals.totalGrossWeight} Kg`, 170, y + 8.4, { align: "right" });

  doc.text("+ Courier / Freight Charges:", margin + 3, y + 12.6);
  doc.text(`${currency} ${totals.courierCharges.toFixed(2)}`, rightEdge - 2, y + 12.6, { align: "right" });

  doc.line(margin, y + 14.5, rightEdge, y + 14.5);
  doc.setFontSize(8.5);
  doc.text("TOTAL INVOICE VALUE (Customs Purpose):", margin + 3, y + 17.8);
  doc.text(`${currency} ${totals.totalInvoiceValue.toFixed(2)}`, rightEdge - 2, y + 17.8, { align: "right" });

  // Certification Declaration
  y += totBoxH + 3;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.5);
  doc.text("We hereby certify that the information on this invoice is true and that the contents of this are as stated above.", margin + 2, y + 2.5);
  doc.text("Above invoice value is for custom declaration purpose only. These are free of charge samples of no commercial value.", margin + 2, y + 5.5);

  // Signatures Section (Anchored cleanly at bottom)
  const sigSectionY = pageHeight - margin - 22;
  const signatureBase64 = await loadImageBase64(dispatchData.sender?.signatureUrl || dispatchData.sender?.signatureBase64);
  if (signatureBase64) {
    doc.addImage(signatureBase64, "PNG", margin + 4, sigSectionY - 8, 36, 11);
  }

  doc.line(margin + 2, sigSectionY + 4, margin + 65, sigSectionY + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Authorized Signature & Stamp", margin + 2, sigSectionY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(dispatchData.sender?.designation || "Manager Marketing", margin + 2, sigSectionY + 12);
  doc.text(dispatchData.sender?.companyName || "Toyo Cushion Lanka (Pvt) Ltd", margin + 2, sigSectionY + 16);

  doc.line(145, sigSectionY + 4, rightEdge - 2, sigSectionY + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Date:", 145, sigSectionY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.shippingDate || new Date().toISOString().split("T")[0], 158, sigSectionY + 8);

  return doc;
}

/**
 * 2. Generates Phyto Application PDF with Sri Lanka National Emblem
 * Solid Black & White, high precision regulatory layout
 */
export async function generatePhytoApplicationPDF(dispatchData, docInstance = null) {
  const doc = docInstance || new jsPDF("p", "mm", "a4");
  const totals = calculateDispatchTotals(dispatchData);

  const margin = 10;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = 190;
  const rightEdge = margin + contentWidth;

  // Outer Border
  doc.setLineWidth(0.4);
  doc.setDrawColor(0, 0, 0);
  doc.rect(margin, margin, contentWidth, pageHeight - 2 * margin);

  // Sri Lanka Emblem (Top Center)
  const emblemBase64 = await loadImageBase64(emblemUrl);
  if (emblemBase64) {
    doc.addImage(emblemBase64, "PNG", 97, margin + 2, 16, 20);
  }

  // Header Titles - Generous spacing below emblem
  let y = margin + 30;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(0, 0, 0);
  doc.text("DEPARTMENT OF AGRICULTURE, SRI LANKA", 105, y, { align: "center" });

  doc.setFontSize(9.5);
  doc.text("APPLICATION FOR PHYTOSANITARY CERTIFICATE", 105, y + 5, { align: "center" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text("Application for Phytosanitary Certificate / For Re-Export", 105, y + 9.2, { align: "center" });

  doc.line(margin, y + 12, rightEdge, y + 12);

  // Exporter & Consignee Box
  y += 13;
  const halfW = contentWidth / 2;
  const colRightX = margin + halfW;
  const boxH = 26;

  // Exporter
  doc.rect(margin, y, halfW, boxH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("1. Name and address of exporter:", margin + 2, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const expLines = doc.splitTextToSize(
    `${dispatchData.sender?.name || ""}\n${dispatchData.sender?.address || ""}\nTel: ${dispatchData.sender?.contact || ""}`,
    halfW - 4
  );
  doc.text(expLines.slice(0, 4), margin + 2, y + 8);

  // Consignee
  doc.rect(colRightX, y, halfW, boxH);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("2. Name and address of consignee:", colRightX + 2, y + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const conLines = doc.splitTextToSize(
    `${dispatchData.receiver?.name || ""}\n${dispatchData.receiver?.address || ""}\nTel: ${dispatchData.receiver?.contact || ""}`,
    halfW - 4
  );
  doc.text(conLines.slice(0, 4), colRightX + 2, y + 8);

  // Transport Details Grid (Sections 3-6)
  y += boxH;
  const metaH = 17;
  doc.rect(margin, y, contentWidth, metaH);
  doc.line(colRightX, y, colRightX, y + metaH);
  doc.line(margin, y + 8.5, rightEdge, y + 8.5);

  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("3. Place of origin:", margin + 2, y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.sender?.originCity || "COLOMBO, SRI LANKA", margin + 30, y + 5.5);

  doc.setFont("helvetica", "bold");
  doc.text("4. Airway Bill No:", colRightX + 2, y + 5.5);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.waybillNo || "N/A", colRightX + 30, y + 5.5);

  doc.setFont("helvetica", "bold");
  doc.text("5. Means of conveyance:", margin + 2, y + 14);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.sender?.meansOfConveyance || "BY COURIER FROM COLOMBO, SRI LANKA", margin + 38, y + 14);

  doc.setFont("helvetica", "bold");
  doc.text("6. Point of entry / Use:", colRightX + 2, y + 14);
  doc.setFont("helvetica", "normal");
  doc.text(`${dispatchData.receiver?.country || ""}  |  ${dispatchData.logistics?.intendedUse || "As samples"}`, colRightX + 38, y + 14);

  // Commodity Section
  y += metaH + 2;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 6, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7);
  doc.text("7. Distinguishing marks; No. and description of packages; Name of produce (including botanical name of plants)", margin + 2, y + 4.2);

  // Table Header
  y += 6;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 5.5, "FD");
  doc.setFontSize(7);
  doc.text("No.", margin + 2, y + 3.8);
  doc.text("Produce Name & Botanical Name", margin + 10, y + 3.8);
  doc.text("Quantity", 125, y + 3.8, { align: "right" });
  doc.text("Unit", 140, y + 3.8);
  doc.text("Net Wt (Kg)", 165, y + 3.8, { align: "right" });
  doc.text("Gross Wt (Kg)", rightEdge - 2, y + 3.8, { align: "right" });

  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  totals.computedItems.forEach((item, idx) => {
    const itemDesc = `${item.description} (${item.botanicalName || "Cocos nucifera"})`;
    const lines = doc.splitTextToSize(itemDesc, 95);
    const rowH = Math.max(5.2, lines.length * 3.2 + 2);

    doc.rect(margin, y, contentWidth, rowH);
    doc.text(String(idx + 1), margin + 2, y + 3.6);
    doc.text(lines, margin + 10, y + 3.6);
    doc.text(String(item.qty), 125, y + 3.6, { align: "right" });
    doc.text(item.unit || "pcs", 140, y + 3.6);
    doc.text(Number(item.weightKg).toFixed(1), 165, y + 3.6, { align: "right" });
    doc.text(idx === 0 ? String(totals.totalGrossWeight) : "-", rightEdge - 2, y + 3.6, { align: "right" });

    y += rowH;
  });

  // Table Totals
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 5.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Total Consignment Weights:", margin + 3, y + 3.8);
  doc.text(`${totals.totalNetWeight} Kg Net`, 165, y + 3.8, { align: "right" });
  doc.text(`${totals.totalGrossWeight} Kg Gross`, rightEdge - 2, y + 3.8, { align: "right" });

  // Regulatory Declaration Text
  y += 8;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.8);
  const phytoDecl = "Kindly inspect the products described above and issue a Phytosanitary Certificate in accordance with Article V of the International Plant Protection Convention, 1951, as amended in 1979. I declare that the particulars given in this application are correct.";
  const pLines = doc.splitTextToSize(phytoDecl, contentWidth - 4);
  doc.text(pLines, margin + 2, y);

  // Signature Block
  const sigY = pageHeight - margin - 52;
  const signatureBase64 = await loadImageBase64(dispatchData.sender?.signatureUrl || dispatchData.sender?.signatureBase64);
  if (signatureBase64) {
    doc.addImage(signatureBase64, "PNG", margin + 4, sigY - 8, 36, 11);
  }

  doc.line(margin + 2, sigY + 4, margin + 65, sigY + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Exporter's Signature & Official Seal", margin + 2, sigY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(dispatchData.sender?.designation || "Manager Marketing", margin + 2, sigY + 12);
  doc.text(`For ${dispatchData.sender?.companyName || "Toyo Cushion Lanka (Pvt) Ltd."}`, margin + 2, sigY + 16);

  doc.line(145, sigY + 4, rightEdge - 2, sigY + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Date of Application:", 145, sigY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.shippingDate || new Date().toISOString().split("T")[0], 175, sigY + 8);

  // Office Use Only Box (Fixed at bottom)
  const offY = pageHeight - margin - 30;
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, offY, contentWidth, 28, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("FOR OFFICIAL USE ONLY (NATIONAL PLANT QUARANTINE SERVICE)", margin + 3, offY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text("Certificate No: ................................................................", margin + 3, offY + 10);
  doc.text("Date of Inspection: ........................................................", margin + 3, offY + 16);
  doc.text("Inspecting Officer: ........................................................", margin + 3, offY + 22);
  doc.text("Official Stamp & Signature: ..........................................", 115, offY + 22);

  return doc;
}

/**
 * 3. Generates Export Packing List PDF (PQS/EXP/02)
 * Solid Black & White, high precision regulatory layout
 */
export async function generatePackingListPDF(dispatchData, docInstance = null) {
  const doc = docInstance || new jsPDF("p", "mm", "a4");
  const totals = calculateDispatchTotals(dispatchData);

  const margin = 10;
  const pageWidth = 210;
  const pageHeight = 297;
  const contentWidth = 190;
  const rightEdge = margin + contentWidth;

  // Outer Border
  doc.setLineWidth(0.4);
  doc.setDrawColor(0, 0, 0);
  doc.rect(margin, margin, contentWidth, pageHeight - 2 * margin);

  // Top Code & PSC No.
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("PQS/EXP/02", rightEdge - 2, margin + 4.5, { align: "right" });
  doc.setFont("helvetica", "normal");
  doc.text(`PSC No: ${dispatchData.logistics?.pscNo || "(Office use only)"}`, rightEdge - 2, margin + 8.5, { align: "right" });

  // Main Header Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("EXPORT PACKING LIST", 105, margin + 6.5, { align: "center" });

  doc.setFontSize(9);
  doc.text(dispatchData.sender?.companyName || "TOYO CUSHION LANKA (PVT) LTD", 105, margin + 11.5, { align: "center" });
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${dispatchData.sender?.companyAddress || "No.25, Foster Lane, Colombo 10"} | Tel: ${dispatchData.sender?.contact || "+9474 216 8231"}`, 105, margin + 15.5, { align: "center" });

  doc.line(margin, margin + 18, rightEdge, margin + 18);

  // Section 1: Details of Consignment
  let y = margin + 20;
  const colRightX = margin + (contentWidth / 2);

  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("1. DETAILS OF THE CONSIGNMENT", margin + 2, y + 3.6);

  y += 5;
  const s1H = 17;
  doc.rect(margin, y, contentWidth, s1H);
  doc.line(colRightX, y, colRightX, y + s1H);
  doc.line(margin, y + 5.6, rightEdge, y + 5.6);
  doc.line(margin, y + 11.2, rightEdge, y + 11.2);

  doc.setFontSize(7.5);
  doc.text("Exporting Country:", margin + 2, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.receiver?.country || "", margin + 30, y + 4);

  doc.setFont("helvetica", "bold");
  doc.text("Airway Bill No:", colRightX + 2, y + 4);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.waybillNo || "N/A", colRightX + 28, y + 4);

  doc.setFont("helvetica", "bold");
  doc.text("Exporter Address:", margin + 2, y + 9.5);
  doc.setFont("helvetica", "normal");
  const expAddr = doc.splitTextToSize(dispatchData.sender?.address || "", 65);
  doc.text(expAddr[0] || "", margin + 30, y + 9.5);

  doc.setFont("helvetica", "bold");
  doc.text("Invoice No:", colRightX + 2, y + 9.5);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.dispatchNo || dispatchData.logistics?.invoiceNo || "N/A", colRightX + 22, y + 9.5);

  doc.setFont("helvetica", "bold");
  doc.text("Port of Entry:", margin + 2, y + 15);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.receiver?.portOfEntry || dispatchData.receiver?.country || "", margin + 30, y + 15);

  doc.setFont("helvetica", "bold");
  doc.text("PQ Reg No:", colRightX + 2, y + 15);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.logistics?.pqRegNo || "N/A", colRightX + 22, y + 15);

  // Section 2: Details of Wharf Clerk / Forwarding Agent
  y += s1H + 2;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("2. DETAILS OF WHARF CLERK / FORWARDING AGENT", margin + 2, y + 3.6);

  y += 5;
  const s2H = 12;
  doc.rect(margin, y, contentWidth, s2H);
  doc.line(colRightX, y, colRightX, y + s2H);
  doc.line(margin, y + 6, rightEdge, y + 6);

  doc.setFontSize(7.5);
  doc.text("Name:", margin + 2, y + 4.2);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.logistics?.wharfClerkName || "N/A", margin + 15, y + 4.2);

  doc.setFont("helvetica", "bold");
  doc.text("ID No:", colRightX + 2, y + 4.2);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.logistics?.wharfClerkId || "N/A", colRightX + 15, y + 4.2);

  doc.setFont("helvetica", "bold");
  doc.text("Contact Tel:", margin + 2, y + 10.2);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.logistics?.wharfClerkContact || "N/A", margin + 22, y + 10.2);

  doc.setFont("helvetica", "bold");
  doc.text("CHA Reg No:", colRightX + 2, y + 10.2);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.logistics?.wharfClerkChaReg || "N/A", colRightX + 24, y + 10.2);

  // Section 3: Details of Commodities
  y += s2H + 2;
  doc.setFillColor(240, 240, 240);
  doc.rect(margin, y, contentWidth, 5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("3. DETAILS OF COMMODITIES", margin + 2, y + 3.6);

  y += 5;
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 5.5, "FD");
  doc.setFontSize(7);

  doc.text("S.No", margin + 2, y + 3.8);
  doc.text("Item / Common Name", margin + 10, y + 3.8);
  doc.text("Botanical Name", 85, y + 3.8);
  doc.text("Box No", 125, y + 3.8);
  doc.text("No. Boxes", 145, y + 3.8);
  doc.text("Net Wt (Kg)", 165, y + 3.8, { align: "right" });
  doc.text("Gross Wt", 185, y + 3.8, { align: "right" });
  doc.text("Chk", rightEdge - 2, y + 3.8, { align: "right" });

  y += 5.5;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);

  totals.computedItems.forEach((item, idx) => {
    const descLines = doc.splitTextToSize(item.description || "", 70);
    const rowH = Math.max(5.2, descLines.length * 3.2 + 2);

    doc.rect(margin, y, contentWidth, rowH);
    doc.text(String(idx + 1), margin + 2, y + 3.6);
    doc.text(descLines, margin + 10, y + 3.6);
    doc.text(item.botanicalName || "Cocos nucifera", 85, y + 3.6);
    doc.text(item.boxNo || `Box ${idx + 1}`, 125, y + 3.6);
    doc.text(String(totals.noOfBoxes), 148, y + 3.6);
    doc.text(Number(item.weightKg).toFixed(1), 165, y + 3.6, { align: "right" });
    doc.text(idx === 0 ? String(totals.totalGrossWeight) : "-", 185, y + 3.6, { align: "right" });
    doc.text("✓", rightEdge - 3, y + 3.6, { align: "right" });

    y += rowH;
  });

  // Table Totals
  doc.setFillColor(245, 245, 245);
  doc.rect(margin, y, contentWidth, 5.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("TOTALS:", margin + 3, y + 3.8);
  doc.text(`Total Boxes: ${totals.noOfBoxes}`, 125, y + 3.8);
  doc.text(`${totals.totalNetWeight} Kg`, 165, y + 3.8, { align: "right" });
  doc.text(`${totals.totalGrossWeight} Kg`, 185, y + 3.8, { align: "right" });

  y += 5.5;

  // Note text with generous spacing
  y += 6.5;
  doc.setFont("helvetica", "italic");
  doc.setFontSize(6.8);
  doc.text("(Note - If you collect any commodity from the certified fields please paste stickers on the other side of the packing list)", margin + 2, y);

  // Declaration text with ample spacing below
  y += 5.5;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Above items and quantities are ready for export.", margin + 2, y);

  // Signatures Section
  const sigY = pageHeight - margin - 40;
  const signatureBase64 = await loadImageBase64(dispatchData.sender?.signatureUrl || dispatchData.sender?.signatureBase64);
  if (signatureBase64) {
    doc.addImage(signatureBase64, "PNG", margin + 4, sigY - 8, 36, 11);
  }

  doc.line(margin + 2, sigY + 4, margin + 65, sigY + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Authorized Officer Signature", margin + 2, sigY + 8);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(dispatchData.sender?.designation || "Manager Marketing", margin + 2, sigY + 12);
  doc.text(dispatchData.sender?.companyName || "Toyo Cushion Lanka (Pvt) Ltd", margin + 2, sigY + 16);

  doc.line(145, sigY + 4, rightEdge - 2, sigY + 4);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Date:", 145, sigY + 8);
  doc.setFont("helvetica", "normal");
  doc.text(dispatchData.shippingDate || new Date().toISOString().split("T")[0], 158, sigY + 8);

  // Director Customs Footer Box
  const custY = pageHeight - margin - 20;
  doc.setDrawColor(0, 0, 0);
  doc.setFillColor(250, 250, 250);
  doc.rect(margin, custY, contentWidth, 18, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("To: Director Customs / NPQS Inspector", margin + 3, custY + 4.5);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Location: ${dispatchData.logistics?.directorCustomsNote || "BIA, Katunayake, Sri Lanka"}`, margin + 3, custY + 9.5);
  doc.text("Certified for export customs clearance and quarantine inspection.", margin + 3, custY + 14);

  return doc;
}

/**
 * 4. Generates Complete 3-in-1 Dispatch Documentation Bundle PDF
 */
export async function generateCompleteDispatchBundlePDF(dispatchData) {
  const doc = new jsPDF("p", "mm", "a4");

  // Page 1: Commercial / Sample Invoice
  await generateSampleInvoicePDF(dispatchData, doc);

  // Page 2: Phyto Application
  doc.addPage();
  await generatePhytoApplicationPDF(dispatchData, doc);

  // Page 3: Export Packing List
  doc.addPage();
  await generatePackingListPDF(dispatchData, doc);

  return doc;
}

/**
 * Helper to download PDF in browser
 */
export async function downloadPdfFile(pdfDocPromise, filename) {
  const doc = await pdfDocPromise;
  doc.save(filename);
}
