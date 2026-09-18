import { jsPDF } from "jspdf";
import logoUrl from "../assets/hayleys-fibre-eco-solutions.jpg";
import { DEFAULT_COMPANY_DETAILS, getDisplayPrice } from "./quotationCalculations";

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
 * Generates and downloads the official Price Quotation PDF in Landscape Orientation (A4)
 * Formatted with a clean, formal Black & White / Monochrome structural design matching Excel.
 */
export async function downloadQuotationPDF(quotationData) {
  if (!quotationData) return;

  const {
    quotationNo = "PQ-001",
    quotationDate = new Date().toISOString().split("T")[0],
    category = "bedding",
    buyerName = "Customer",
    shipper = DEFAULT_COMPANY_DETAILS,
    containerSize = "40ft",
    priceTerm = "FOB",
    paymentTerms = "100% Advance (For the first order delivery)",
    leadTime = "+/- 10% 4-5 weeks",
    validity = "30 Days from date of quotation",
    packing = category === "bedding" ? "Coir Sheet/Poly bag/Bundle pack/Pallet" : "Carton Boxes/Floor load/Pallet",
    items = [],
    financialParams = {},
    selectedColumns = null
  } = quotationData;

  // Initialize Landscape A4 (297mm width x 210mm height)
  const doc = new jsPDF("l", "mm", "a4");
  const pageWidth = 297;
  const pageHeight = 210;
  const margin = 10;
  const contentWidth = pageWidth - (2 * margin); // 277mm
  const tableWidth = contentWidth - 4; // 273mm exact table grid

  const isBedding = category.toLowerCase().includes("bed");

  // Pre-load logo, signature stamp, and item images in parallel
  const [logoBase64, sigImageBase64, ...itemImagesBase64] = await Promise.all([
    loadImageBase64(logoUrl),
    loadImageBase64(shipper.signatureImage),
    ...items.map(item => loadImageBase64(item.imageUrl))
  ]);

  // Outer Double-Border (Formal B&W standard)
  doc.setLineWidth(0.4);
  doc.setDrawColor(0, 0, 0);
  doc.rect(margin, margin, contentWidth, pageHeight - (2 * margin));

  // Top Section: Header & Ref / Date Box
  let y = margin + 3;

  // 1. Header Box (Title & Logo on left, Ref & Date on right)
  doc.setLineWidth(0.3);
  doc.setDrawColor(0, 0, 0);
  
  const headerRightWidth = 75;
  const headerLeftWidth = tableWidth - headerRightWidth; // 198mm

  doc.setFillColor(250, 250, 250);
  doc.rect(margin + 2, y, headerLeftWidth, 16, "FD");
  doc.rect(margin + 2 + headerLeftWidth, y, headerRightWidth, 16, "D");

  // Header Left: Logo + "Price Quotation" Title
  let textStartX = margin + 6;
  if (logoBase64) {
    try {
      doc.addImage(logoBase64, "JPEG", margin + 5, y + 2, 32, 12);
      textStartX = margin + 42;
    } catch (e) {
      textStartX = margin + 6;
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(16);
  doc.setTextColor(0, 0, 0);
  doc.text("Price Quotation", textStartX, y + 10.5);

  // Header Right: Quotation Ref Number & Date
  doc.setFontSize(7.5);
  doc.setFont("helvetica", "bold");
  doc.text("Quotation ref number :", margin + 2 + headerLeftWidth + 4, y + 5.5);
  doc.setFont("helvetica", "bold");
  doc.text(quotationNo, margin + 2 + headerLeftWidth + 38, y + 5.5);

  doc.line(margin + 2 + headerLeftWidth, y + 8, margin + 2 + tableWidth, y + 8);

  doc.setFont("helvetica", "bold");
  doc.text("Date :", margin + 2 + headerLeftWidth + 4, y + 13);
  doc.setFont("helvetica", "normal");
  doc.text(quotationDate, margin + 2 + headerLeftWidth + 38, y + 13);

  y += 18;

  // 2. Shipper & Buyer Grid Boxes (Exact B6:T8 layout)
  const boxWidth = tableWidth / 2; // 136.5mm each
  const boxHeight = 18;

  doc.rect(margin + 2, y, boxWidth, boxHeight, "D");
  doc.rect(margin + 2 + boxWidth, y, boxWidth, boxHeight, "D");

  // Shipper Block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.setTextColor(0, 0, 0);
  doc.text("Shipper :", margin + 5, y + 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text(shipper.shipperName || "Toyo Cushion Lanka", margin + 5, y + 8);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6.5);
  doc.text(`COMPANY NO : ${shipper.companyNo || "PV 5492"}`, margin + 5, y + 11.5);
  doc.text(shipper.address || "400 Deans Road Colombo 10 01000 Sri Lanka", margin + 5, y + 14.5);
  doc.text(`Tel: ${shipper.phone || "94112232939-Fixed"}`, margin + 5, y + 17.5);

  // Buyer Block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(7.5);
  doc.text("Buyer :", margin + 2 + boxWidth + 4, y + 4);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text(buyerName, margin + 2 + boxWidth + 4, y + 8.5);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.text(`Category: ${category.toUpperCase()}   |   Pricing Basis: ${priceTerm} (${containerSize} Container)`, margin + 2 + boxWidth + 4, y + 13.5);

  y += 20;

  // 3. Master Table Column Layouts
  let masterCols = [];
  if (isBedding) {
    // Bedding Master Columns
    masterCols = [
      { key: "idx", dataKey: "idx", title: "#", subTitle: "#", baseWidth: 7, align: "center" },
      { key: "image", dataKey: "imageUrl", title: "Image", subTitle: "Images", baseWidth: 14, align: "center" },
      { key: "spec", dataKey: "description", title: "Product spec", subTitle: "As per cost req", baseWidth: 44, align: "left" },
      { key: "length", dataKey: "length", title: "L(CM)", subTitle: "As req", baseWidth: 10, align: "center" },
      { key: "width", dataKey: "width", title: "W(CM)", subTitle: "As req", baseWidth: 10, align: "center" },
      { key: "height", dataKey: "height", title: "H(CM)", subTitle: "As req", baseWidth: 10, align: "center" },
      { key: "organic", dataKey: "organic", title: "Org/Non", subTitle: "Type", baseWidth: 13, align: "center" },
      { key: "ncrc", dataKey: "ncRcRatio", title: "NC/RC", subTitle: "Ratio", baseWidth: 11, align: "center" },
      { key: "density", dataKey: "density", title: "Density", subTitle: "kg/m3", baseWidth: 11, align: "center" },
      { key: "qtyBdl", dataKey: "qtyPerBundle", title: "Qty/Bdl", subTitle: "Bundle", baseWidth: 11, align: "center" },
      { key: "pltSize", dataKey: "palletSize", title: "Pallet", subTitle: "Size", baseWidth: 12, align: "center" },
      { key: "bdlPlt", dataKey: "bundlesPerPallet", title: "Bdl/Plt", subTitle: "As req", baseWidth: 12, align: "center" },
      { key: "plts20", dataKey: "palletsPer20ft", title: "Plt20", subTitle: "20ft", baseWidth: 11, align: "center" },
      { key: "plts40", dataKey: "palletsPer40ft", title: "Plt40", subTitle: "40ft", baseWidth: 11, align: "center" },
      { key: "price", dataKey: "quotedPrice", title: `Price (${priceTerm})`, subTitle: "Auto cal", baseWidth: 18, align: "center" },
      { key: "bdl20", dataKey: "bundlesPer20ft", title: "Bdl20ft", subTitle: "Auto cal", baseWidth: 12, align: "center" },
      { key: "qty20", dataKey: "qtyPer20ft", title: "Qty 20ft", subTitle: "Auto pick", baseWidth: 15, align: "center" },
      { key: "bdl40", dataKey: "bundlesPer40ft", title: "Bdl40ft", subTitle: "Auto cal", baseWidth: 12, align: "center" },
      { key: "qty40", dataKey: "qtyPer40ft", title: "Qty 40ft", subTitle: "Auto pick", baseWidth: 15, align: "center" }
    ];
  } else {
    // Horticulture Master Columns
    masterCols = [
      { key: "idx", dataKey: "idx", title: "#", subTitle: "#", baseWidth: 7, align: "center" },
      { key: "image", dataKey: "imageUrl", title: "Image", subTitle: "Images", baseWidth: 15, align: "center" },
      { key: "spec", dataKey: "description", title: "Product spec", subTitle: "As per cost req data", baseWidth: 60, align: "left" },
      { key: "packing", dataKey: "packing", title: "Pack (Ctn/Bdl)", subTitle: "As req", baseWidth: 16, align: "center" },
      { key: "ctnSize", dataKey: "cartonSize", title: "Ctn/Bdl Size", subTitle: "CM", baseWidth: 18, align: "center" },
      { key: "pltSize", dataKey: "palletSize", title: "Pallet", subTitle: "Size", baseWidth: 13, align: "center" },
      { key: "ctnPlt", dataKey: "cartonsPerPallet", title: "Ctns/Bdls/Plt", subTitle: "As req", baseWidth: 14, align: "center" },
      { key: "plts20", dataKey: "palletsPer20ft", title: "Plt 20ft", subTitle: "Marketing", baseWidth: 12, align: "center" },
      { key: "plts40", dataKey: "palletsPer40ft", title: "Plt 40ft", subTitle: "Marketing", baseWidth: 12, align: "center" },
      { key: "rollDiameter", dataKey: "rollDiameter", title: "Roll Dia", subTitle: "CM", baseWidth: 12, align: "center" },
      { key: "price", dataKey: "quotedPrice", title: `Price (${priceTerm})`, subTitle: "Auto cal", baseWidth: 20, align: "center" },
      { key: "ctn20", dataKey: "cartonsPer20ft", title: "Ctn/Bdl 20ft", subTitle: "Auto pick", baseWidth: 16, align: "center" },
      { key: "qty20", dataKey: "qtyPer20ft", title: "Qty 20ft", subTitle: "Auto pick", baseWidth: 18, align: "center" },
      { key: "ctn40", dataKey: "cartonsPer40ft", title: "Ctn/Bdl 40ft", subTitle: "Auto pick", baseWidth: 16, align: "center" },
      { key: "qty40", dataKey: "qtyPer40ft", title: "Qty 40ft", subTitle: "Auto pick", baseWidth: 18, align: "center" }
    ];
  }

  // Filter columns based strictly on unchecked / selected columns
  let cols = masterCols;
  if (Array.isArray(selectedColumns) && selectedColumns.length > 0) {
    cols = masterCols.filter(col => selectedColumns.includes(col.dataKey) || selectedColumns.includes(col.key));
  }
  if (cols.length === 0) cols = masterCols;

  // Dynamically scale column widths so table always spans exactly tableWidth (273mm)
  const totalBaseWidth = cols.reduce((sum, c) => sum + (c.baseWidth || 10), 0);
  const scaleRatio = tableWidth / totalBaseWidth;
  cols = cols.map(c => ({
    ...c,
    width: (c.baseWidth || 10) * scaleRatio
  }));

  // Draw 2-Tier Table Header Rows (matching Excel Row 9 & Row 10)
  const headerHeight1 = 5;
  const headerHeight2 = 4.5;
  const totalHeaderHeight = headerHeight1 + headerHeight2;

  doc.setFillColor(235, 235, 235);
  doc.rect(margin + 2, y, tableWidth, headerHeight1, "FD");
  doc.setFillColor(245, 245, 245);
  doc.rect(margin + 2, y + headerHeight1, tableWidth, headerHeight2, "FD");

  let curX = margin + 2;
  cols.forEach(col => {
    // Vertical grid lines
    doc.line(curX, y, curX, y + totalHeaderHeight);

    // Header Tier 1 Text
    doc.setFont("helvetica", "bold");
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);
    if (col.align === "center") {
      doc.text(col.title, curX + (col.width / 2), y + 3.5, { align: "center" });
    } else {
      doc.text(col.title, curX + 1.5, y + 3.5);
    }

    // Header Tier 2 Sub-Text
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5);
    doc.setTextColor(70, 70, 70);
    if (col.align === "center") {
      doc.text(col.subTitle, curX + (col.width / 2), y + headerHeight1 + 3.2, { align: "center" });
    } else {
      doc.text(col.subTitle, curX + 1.5, y + headerHeight1 + 3.2);
    }

    curX += col.width;
  });
  doc.line(curX, y, curX, y + totalHeaderHeight);
  doc.line(margin + 2, y + headerHeight1, margin + 2 + tableWidth, y + headerHeight1);
  doc.line(margin + 2, y + totalHeaderHeight, margin + 2 + tableWidth, y + totalHeaderHeight);

  y += totalHeaderHeight;

  // Table Body Rows
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const imgBase64 = itemImagesBase64[i];
    const dispPrice = getDisplayPrice(item, priceTerm, containerSize, financialParams.cifRate);
    const rowHeight = 15;

    // Check pagination (Ensure space for bottom box on final page)
    if (y + rowHeight > 148) {
      doc.addPage("a4", "l");
      y = margin + 8;
      doc.setLineWidth(0.4);
      doc.setDrawColor(0, 0, 0);
      doc.rect(margin, margin, contentWidth, pageHeight - (2 * margin));
    }

    doc.rect(margin + 2, y, tableWidth, rowHeight, "D");

    curX = margin + 2;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6);
    doc.setTextColor(0, 0, 0);

    cols.forEach(col => {
      doc.line(curX, y, curX, y + rowHeight);

      if (col.key === "idx") {
        doc.setFont("helvetica", "bold");
        doc.text(String(i + 1), curX + (col.width / 2), y + 8, { align: "center" });
        doc.setFont("helvetica", "normal");
      } else if (col.key === "image") {
        if (imgBase64) {
          try {
            doc.addImage(imgBase64, "JPEG", curX + 1.5, y + 1.5, col.width - 3, 12);
          } catch (e) {
            doc.text("-", curX + (col.width / 2), y + 8, { align: "center" });
          }
        } else {
          doc.text("-", curX + (col.width / 2), y + 8, { align: "center" });
        }
      } else if (col.key === "spec") {
        const titleText = item.description || `Item #${i + 1}`;
        const specText = item.specifications || "";
        doc.setFont("helvetica", "bold");
        doc.setFontSize(6);
        const splitTitle = doc.splitTextToSize(titleText, col.width - 2);
        doc.text(splitTitle[0] || "", curX + 1, y + 4.5);
        
        doc.setFont("helvetica", "normal");
        doc.setFontSize(5);
        const splitSpec = doc.splitTextToSize(specText, col.width - 2);
        doc.text(splitSpec.slice(0, 3), curX + 1, y + 8);
      } else if (col.key === "length") {
        doc.text(String(item.length || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "width") {
        doc.text(String(item.width || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "height") {
        doc.text(String(item.height || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "organic") {
        doc.text(item.organic === "Organic" ? "Organic" : "Non-Org", curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "ncrc") {
        doc.text(String(item.ncRcRatio || "80:20"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "density") {
        doc.text(String(item.density || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "qtyBdl") {
        doc.text(String(item.qtyPerBundle || 1), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "packing") {
        doc.text(String(item.packing || 128), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "ctnSize") {
        doc.text(String(item.cartonSize || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "pltSize") {
        doc.text(String(item.palletSize || "TBA"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "bdlPlt") {
        doc.text(String(item.bundlesPerPallet || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "ctnPlt") {
        doc.text(String(item.cartonsPerPallet || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "plts40") {
        doc.text(String(item.palletsPer40ft || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "plts20") {
        doc.text(String(item.palletsPer20ft || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "rollDiameter") {
        doc.text(String(item.rollDiameter || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "price") {
        doc.setFont("helvetica", "bold");
        doc.setFontSize(7);
        doc.text(dispPrice.label, curX + (col.width / 2), y + 8, { align: "center" });
        doc.setFont("helvetica", "normal");
      } else if (col.key === "bdl20") {
        doc.text(String(item.bundlesPer20ft || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "bdl40") {
        doc.text(String(item.bundlesPer40ft || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "ctn40") {
        doc.text(String(item.cartonsPer40ft || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "ctn20") {
        doc.text(String(item.cartonsPer20ft || "-"), curX + (col.width / 2), y + 8, { align: "center" });
      } else if (col.key === "qty40") {
        doc.setFont("helvetica", "bold");
        doc.text(Number(item.qtyPer40ft || 0).toLocaleString(), curX + (col.width / 2), y + 8, { align: "center" });
        doc.setFont("helvetica", "normal");
      } else if (col.key === "qty20") {
        doc.setFont("helvetica", "bold");
        doc.text(Number(item.qtyPer20ft || 0).toLocaleString(), curX + (col.width / 2), y + 8, { align: "center" });
        doc.setFont("helvetica", "normal");
      }

      curX += col.width;
    });

    y += rowHeight;
  }

  // 4. Commercial Notes & Terms (Bottom Box - Exact match of Excel rows 15 - 26)
  const bottomBoxY = Math.max(y + 3, 149);
  const bottomBoxHeight = 45;

  doc.rect(margin + 2, bottomBoxY, tableWidth, bottomBoxHeight, "D");

  // Title Note
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("Note :", margin + 5, bottomBoxY + 5.5);

  // Note items grid
  doc.setFont("helvetica", "bold");
  doc.setFontSize(6.5);
  doc.text("Packing :", margin + 5, bottomBoxY + 10.5);
  doc.setFont("helvetica", "normal");
  doc.text(packing, margin + 26, bottomBoxY + 10.5);

  doc.setFont("helvetica", "bold");
  doc.text("Price term :", margin + 5, bottomBoxY + 15.5);
  doc.setFont("helvetica", "normal");
  doc.text(`${priceTerm} (${containerSize} Container)`, margin + 26, bottomBoxY + 15.5);

  doc.setFont("helvetica", "bold");
  doc.text("Payment terms :", margin + 5, bottomBoxY + 20.5);
  doc.setFont("helvetica", "normal");
  doc.text(paymentTerms, margin + 26, bottomBoxY + 20.5);

  doc.setFont("helvetica", "bold");
  doc.text("Validity :", margin + 5, bottomBoxY + 25.5);
  doc.setFont("helvetica", "normal");
  doc.text(validity, margin + 26, bottomBoxY + 25.5);

  doc.setFont("helvetica", "bold");
  doc.text("Utilization Lead time :", margin + 5, bottomBoxY + 30.5);
  doc.setFont("helvetica", "normal");
  doc.text(leadTime, margin + 34, bottomBoxY + 30.5);

  // Bottom Shipper address line
  doc.setFont("helvetica", "normal");
  doc.setFontSize(6);
  doc.text(`${shipper.shipperName || "Toyo Cushion Lanka"}   |   COMPANY NO : ${shipper.companyNo || "PV 5492"}   |   ${shipper.address || "400 Deans Road Colombo 10 01000 Sri Lanka"}   |   Tel: ${shipper.phone || "94112232939-Fixed"}`, margin + 5, bottomBoxY + 40);

  // Right Signatory block (Populated Sales Officer Details & Signature)
  const sigX = margin + tableWidth - 85;

  if (sigImageBase64) {
    try {
      doc.addImage(sigImageBase64, "PNG", sigX + 18, bottomBoxY + 13, 30, 9);
    } catch (e) {
      console.warn("Could not render signature stamp into PDF:", e);
    }
  }

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(0, 0, 0);
  doc.text("………………………….", sigX + 18, bottomBoxY + 24);

  const officerNameStr = shipper.signatoryName || shipper.signatory || "Manager - Sales & Marketing";
  const officerRoleStr = shipper.signatoryRole || (shipper.signatoryName ? "Manager - Sales & Marketing" : "");

  doc.setFontSize(7.5);
  doc.text(officerNameStr, sigX + 18, bottomBoxY + 28);

  if (officerRoleStr) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(6.5);
    doc.setTextColor(60, 60, 60);
    doc.text(officerRoleStr, sigX + 18, bottomBoxY + 31.5);
  }

  if (shipper.signatoryEmail || shipper.signatoryPhone) {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(5.5);
    doc.setTextColor(100, 100, 100);
    const contactStr = [shipper.signatoryEmail, shipper.signatoryPhone].filter(Boolean).join(" | ");
    doc.text(contactStr, sigX + 18, bottomBoxY + 34.5);
  }

  // Save PDF
  doc.save(`Price_Quotation_${quotationNo}_${buyerName.replace(/\s+/g, "_")}.pdf`);
}
