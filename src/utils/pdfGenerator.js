import { jsPDF } from "jspdf";
import logoUrl from "../assets/hayleys-fibre-eco-solutions.jpg";

/**
 * Loads an image URL asynchronously and returns its Base64 data URL.
 */
const loadImageBase64 = (url) => {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL("image/jpeg");
      resolve(dataURL);
    };
    img.onerror = () => {
      resolve(null);
    };
    img.src = url;
  });
};

/**
 * Generates and downloads the official QP-02-B Sample Requisition Form PDF
 * with Hayleys Fibre Eco Solutions ISO Header, structured sections, and footer.
 */
export async function downloadSamplePDF(request) {
  if (!request) return;

  const doc = new jsPDF("p", "mm", "a4");
  const pageWidth = 210;
  const pageHeight = 297;
  const margin = 10;
  const contentWidth = 190;
  const footerHeight = 10;
  const footerY = 277;

  // 1. Draw Outer Border
  doc.setLineWidth(0.35);
  doc.setDrawColor(70, 70, 70);
  doc.rect(margin, margin, contentWidth, pageHeight - 2 * margin);

  // 2. Load and Draw Logo in Header Left Box
  const logoBase64 = await loadImageBase64(logoUrl);
  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", 13, 12, 42, 19);
  }

  // 3. Header Grid & Dividers (Matching QP-02-B standard)
  doc.line(58, margin, 58, 34); // Logo vertical divider
  doc.line(margin, 34, pageWidth - margin, 34); // Header bottom horizontal line

  doc.line(58, 18, pageWidth - margin, 18); // Row 1 bottom line
  doc.line(58, 26, pageWidth - margin, 26); // Row 2 bottom line
  doc.line(125, 18, 125, 26); // Row 2 vertical divider

  // Header Row 1: Main Procedure Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10.5);
  doc.setTextColor(20, 20, 20);
  doc.text("QUALITY ASSURANCE PROCEDURE", 129, 15.5, { align: "center" });

  // Header Row 2: Procedure No. & Date of Issue
  doc.setFontSize(8.5);
  doc.setFont("helvetica", "bold");
  doc.text("PROCEDURE NO.", 61, 23);
  doc.setFont("helvetica", "normal");
  doc.text("QP 02 B", 89, 23);

  doc.setFont("helvetica", "bold");
  doc.text("Date of Issue:", 128, 23);
  doc.setFont("helvetica", "normal");
  doc.text("19/08/2026", 148, 23);

  // Header Row 3: Form Title
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("TITLE : SAMPLE REQUEST FORM- CONTRACT REVIEW", 129, 31.5, { align: "center" });

  // 4. Section 1 Header: General Requisition Information
  let yPos = 38;
  doc.setFillColor(242, 245, 248);
  doc.rect(margin, yPos, contentWidth, 7.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);
  doc.text("1. GENERAL REQUISITION INFORMATION", 14, yPos + 5.2);

  yPos += 7.5;
  const s1Top = yPos;
  const s1Height = 28;
  doc.rect(margin, s1Top, contentWidth, s1Height);

  doc.line(margin, s1Top + 7, pageWidth - margin, s1Top + 7);
  doc.line(margin, s1Top + 14, pageWidth - margin, s1Top + 14);
  doc.line(margin, s1Top + 21, pageWidth - margin, s1Top + 21);
  doc.line(105, s1Top, 105, s1Top + s1Height);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(40, 40, 40);
  
  // Row 1
  doc.text("Sample Request No:", 14, s1Top + 5);
  doc.setFont("helvetica", "normal");
  doc.text(request.sampleRequestNo || "-", 52, s1Top + 5);

  doc.setFont("helvetica", "bold");
  doc.text("Sample Request Date:", 109, s1Top + 5);
  doc.setFont("helvetica", "normal");
  doc.text(request.requestDate || "-", 150, s1Top + 5);

  // Row 2
  doc.setFont("helvetica", "bold");
  doc.text("Requested By:", 14, s1Top + 12);
  doc.setFont("helvetica", "normal");
  doc.text(request.requestedBy || "-", 52, s1Top + 12);

  doc.setFont("helvetica", "bold");
  doc.text("Required Date:", 109, s1Top + 12);
  doc.setFont("helvetica", "normal");
  doc.text(request.requiredDate || "-", 150, s1Top + 12);

  // Row 3
  doc.setFont("helvetica", "bold");
  doc.text("Customer Name:", 14, s1Top + 19);
  doc.setFont("helvetica", "normal");
  doc.text(request.customerName || "-", 52, s1Top + 19);

  doc.setFont("helvetica", "bold");
  doc.text("Product Unit:", 109, s1Top + 19);
  doc.setFont("helvetica", "normal");
  doc.text(request.productUnit || "-", 150, s1Top + 19);

  // Row 4
  doc.setFont("helvetica", "bold");
  doc.text("Request Type:", 14, s1Top + 26);
  doc.setFont("helvetica", "normal");
  doc.text(request.requestType || "-", 52, s1Top + 26);

  doc.setFont("helvetica", "bold");
  doc.text("Priority / Category:", 109, s1Top + 26);
  doc.setFont("helvetica", "normal");
  doc.text(request.priority || request.category || "Standard", 150, s1Top + 26);

  // 5. Section 2 Header: Sample Specifications & Details
  yPos = s1Top + s1Height + 4;
  doc.setFillColor(242, 245, 248);
  doc.rect(margin, yPos, contentWidth, 7.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("2. SAMPLE SPECIFICATIONS & DETAILS", 14, yPos + 5.2);

  yPos += 7.5;
  doc.line(margin, yPos, pageWidth - margin, yPos);

  if (request.items && request.items.length > 0) {
    // Multi items tabular layout
    doc.setFillColor(250, 250, 250);
    doc.rect(margin, yPos, contentWidth, 7, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("#", 13, yPos + 4.8);
    doc.text("Product Name", 22, yPos + 4.8);
    doc.text("Qty", 68, yPos + 4.8);
    doc.text("Sample Type", 82, yPos + 4.8);
    doc.text("Description / Special Notes", 125, yPos + 4.8);

    yPos += 7;
    doc.line(margin, yPos, pageWidth - margin, yPos);

    doc.setFont("helvetica", "normal");
    request.items.forEach((item, idx) => {
      const prodName = item.product || "-";
      const qty = String(item.quantity || 1);
      const type = item.sampleType || "-";
      const notesCombined = `${item.description || "-"}${item.specialNotes ? `\n[Notes: ${item.specialNotes}]` : ""}`;

      const prodLines = doc.splitTextToSize(prodName, 42);
      const descLines = doc.splitTextToSize(notesCombined, 70);
      const rowHeight = Math.max(9, Math.max(prodLines.length * 4.5, descLines.length * 4.5) + 3);

      doc.text(String(idx + 1), 13, yPos + 5);
      doc.text(prodLines, 22, yPos + 5);
      doc.text(qty, 68, yPos + 5);
      doc.text(type, 82, yPos + 5);
      doc.text(descLines, 125, yPos + 5);

      yPos += rowHeight;
      doc.line(margin, yPos, pageWidth - margin, yPos);
    });
  } else {
    // Single item layout
    const singleTop = yPos;
    const descText = request.description || "-";
    const notesText = request.specialNotes || "-";
    
    const descLines = doc.splitTextToSize(descText, 175);
    const notesLines = doc.splitTextToSize(notesText, 175);
    
    doc.rect(margin, singleTop, contentWidth, 14);
    doc.line(margin, singleTop + 7, pageWidth - margin, singleTop + 7);
    doc.line(105, singleTop, 105, singleTop + 14);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.text("Product Name:", 14, singleTop + 5);
    doc.setFont("helvetica", "normal");
    doc.text(request.product || "-", 52, singleTop + 5);
    
    doc.setFont("helvetica", "bold");
    doc.text("Quantity Required:", 109, singleTop + 5);
    doc.setFont("helvetica", "normal");
    doc.text(String(request.quantity || 1), 150, singleTop + 5);
    
    doc.setFont("helvetica", "bold");
    doc.text("Sample Type:", 14, singleTop + 12);
    doc.setFont("helvetica", "normal");
    doc.text(request.sampleType || "-", 52, singleTop + 12);
    
    doc.setFont("helvetica", "bold");
    doc.text("Specifications Ref:", 109, singleTop + 12);
    doc.setFont("helvetica", "normal");
    doc.text(request.specRef || "As described below", 150, singleTop + 12);
    
    yPos = singleTop + 14;
    
    // Description Box
    const descBoxHeight = Math.max(14, descLines.length * 4.5 + 8);
    doc.rect(margin, yPos, contentWidth, descBoxHeight);
    doc.setFont("helvetica", "bold");
    doc.text("Description of Sample / Specifications:", 14, yPos + 5);
    doc.setFont("helvetica", "normal");
    doc.text(descLines, 14, yPos + 10);
    
    yPos += descBoxHeight;
    
    // Special Notes Box
    const notesBoxHeight = Math.max(14, notesLines.length * 4.5 + 8);
    doc.rect(margin, yPos, contentWidth, notesBoxHeight);
    doc.setFont("helvetica", "bold");
    doc.text("Special Notes / Customer Requirements:", 14, yPos + 5);
    doc.setFont("helvetica", "normal");
    doc.text(notesLines, 14, yPos + 10);
    
    yPos += notesBoxHeight;
  }

  // 6. Section 3 Header: Workflow Lifecycle Status
  yPos += 4;
  doc.setFillColor(242, 245, 248);
  doc.rect(margin, yPos, contentWidth, 7.5, "FD");
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.text("3. WORKFLOW LIFECYCLE STATUS", 14, yPos + 5.2);

  yPos += 7.5;
  const s3Top = yPos;
  const s3Height = 28;
  doc.rect(margin, s3Top, contentWidth, s3Height);

  doc.line(margin, s3Top + 7, pageWidth - margin, s3Top + 7);
  doc.line(margin, s3Top + 14, pageWidth - margin, s3Top + 14);
  doc.line(margin, s3Top + 21, pageWidth - margin, s3Top + 21);
  doc.line(105, s3Top, 105, s3Top + s3Height);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Current Status:", 14, s3Top + 5);
  doc.setFont("helvetica", "normal");
  doc.text(request.status || "-", 52, s3Top + 5);

  doc.setFont("helvetica", "bold");
  doc.text("Action Required:", 109, s3Top + 5);
  doc.setFont("helvetica", "normal");
  doc.text(request.actionRequired || "-", 150, s3Top + 5);

  doc.setFont("helvetica", "bold");
  doc.text("Date Received by Dev:", 14, s3Top + 12);
  doc.setFont("helvetica", "normal");
  doc.text(request.dateReceived || "Awaiting Acceptance", 52, s3Top + 12);

  doc.setFont("helvetica", "bold");
  doc.text("Planned Delivery Date:", 109, s3Top + 12);
  doc.setFont("helvetica", "normal");
  doc.text(request.plannedDeliveryDate || "-", 150, s3Top + 12);

  doc.setFont("helvetica", "bold");
  doc.text("Processed By:", 14, s3Top + 19);
  doc.setFont("helvetica", "normal");
  doc.text(request.processedBy || "Dev Team / Factory", 52, s3Top + 19);

  doc.setFont("helvetica", "bold");
  doc.text("Actual Completion Date:", 109, s3Top + 19);
  doc.setFont("helvetica", "normal");
  doc.text(request.actualCompletionDate || "Pending Completion", 150, s3Top + 19);

  doc.setFont("helvetica", "bold");
  doc.text("Assigned Lead:", 14, s3Top + 26);
  doc.setFont("helvetica", "normal");
  doc.text(request.assignedLead || "Sample Development Officer", 52, s3Top + 26);

  doc.setFont("helvetica", "bold");
  doc.text("Completed By:", 109, s3Top + 26);
  doc.setFont("helvetica", "normal");
  doc.text(request.completedBy || "Pending Sign-off", 150, s3Top + 26);

  // 7. Bottom ISO Quality Assurance Footer Box (Matches SampleHeader.pdf standard)
  doc.setFillColor(255, 255, 255);
  doc.rect(margin, footerY, contentWidth, footerHeight, "FD");
  doc.line(75, footerY, 75, footerY + footerHeight);
  doc.line(140, footerY, 140, footerY + footerHeight);

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.text("PREPARED BY :", 13, footerY + 6.2);
  doc.setFont("helvetica", "normal");
  doc.text("Marketing Executive", 38, footerY + 6.2);

  doc.setFont("helvetica", "bold");
  doc.text("REVIEWED & APPROVED BY :", 78, footerY + 6.2);
  doc.setFont("helvetica", "normal");
  doc.text("GM", 126, footerY + 6.2);

  doc.setFont("helvetica", "bold");
  doc.text("REVISION NO. / Date :", 143, footerY + 6.2);
  doc.setFont("helvetica", "normal");
  doc.text("00 / 0000-00-00", 174, footerY + 6.2);

  // Trigger download
  doc.save(`Sample_Request_${request.sampleRequestNo || "Draft"}.pdf`);
}
