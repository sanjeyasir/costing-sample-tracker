import { jsPDF } from "jspdf";
import logoUrl from "../assets/hayleys-fibre-log.jpg";

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
 * for a given sample request document, complete with corporate branding logo.
 */
export async function downloadSamplePDF(request) {
  if (!request) return;

  const doc = new jsPDF("p", "mm", "a4");
  
  // Outer Border
  doc.setLineWidth(0.5);
  doc.rect(10, 10, 190, 277);
  
  // Load logo and draw it
  const logoBase64 = await loadImageBase64(logoUrl);
  if (logoBase64) {
    doc.addImage(logoBase64, "JPEG", 13, 13, 30, 15);
  }

  // Title Header Block (Shifted title to the right to accommodate logo)
  doc.setFont("helvetica", "bold");
  doc.setFontSize(13);
  doc.text("QP-02-B SAMPLE REQUISITION FORM", 120, 22, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.text("Document Ref: QP-02-B  |  Revision: 01  |  Effective Date: 2026-08-19", 120, 28, { align: "center" });
  
  doc.line(10, 32, 200, 32);
  
  // Section 1 Header: General Information
  doc.setFont("helvetica", "bold");
  doc.setFillColor(245, 247, 250);
  doc.rect(10, 32, 190, 8, "FD");
  doc.setFontSize(10);
  doc.text("1. GENERAL REQUISITION INFORMATION", 15, 37.5);
  
  doc.line(10, 40, 200, 40);
  
  // General Info Details
  doc.setFont("helvetica", "bold");
  doc.text("Sample Request No:", 15, 47);
  doc.setFont("helvetica", "normal");
  doc.text(request.sampleRequestNo || "-", 55, 47);
  
  doc.setFont("helvetica", "bold");
  doc.text("Sample Request Date:", 110, 47);
  doc.setFont("helvetica", "normal");
  doc.text(request.requestDate || "-", 155, 47);
  
  doc.setFont("helvetica", "bold");
  doc.text("Requested By:", 15, 54);
  doc.setFont("helvetica", "normal");
  doc.text(request.requestedBy || "-", 55, 54);
  
  doc.setFont("helvetica", "bold");
  doc.text("Required Date:", 110, 54);
  doc.setFont("helvetica", "normal");
  doc.text(request.requiredDate || "-", 155, 54);
  
  doc.setFont("helvetica", "bold");
  doc.text("Customer Name:", 15, 61);
  doc.setFont("helvetica", "normal");
  doc.text(request.customerName || "-", 55, 61);
  
  doc.setFont("helvetica", "bold");
  doc.text("Product Unit:", 110, 61);
  doc.setFont("helvetica", "normal");
  doc.text(request.productUnit || "-", 155, 61);
  
  doc.setFont("helvetica", "bold");
  doc.text("Request Type:", 15, 68);
  doc.setFont("helvetica", "normal");
  doc.text(request.requestType || "-", 55, 68);
  
  doc.line(10, 74, 200, 74);
  
  // Section 2 Header: Sample Specifications
  doc.setFont("helvetica", "bold");
  doc.setFillColor(245, 247, 250);
  doc.rect(10, 74, 190, 8, "FD");
  doc.text("2. SAMPLE SPECIFICATIONS & DETAILS", 15, 79.5);
  
  doc.line(10, 82, 200, 82);
  
  let yPos = 82;
  
  if (request.items && request.items.length > 0) {
    // Render tabular layout for multiple items
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.text("#", 12, yPos + 5);
    doc.text("Product Name", 20, yPos + 5);
    doc.text("Qty", 65, yPos + 5);
    doc.text("Sample Type", 80, yPos + 5);
    doc.text("Description / Special Notes", 125, yPos + 5);
    
    doc.line(10, yPos + 8, 200, yPos + 8);
    yPos += 8;
    
    doc.setFont("helvetica", "normal");
    request.items.forEach((item, idx) => {
      const prodName = item.product || "-";
      const qty = String(item.quantity || 1);
      const type = item.sampleType || "-";
      const notesCombined = `${item.description || "-"}${item.specialNotes ? `\n[Notes: ${item.specialNotes}]` : ""}`;
      
      const prodLines = doc.splitTextToSize(prodName, 42);
      const descLines = doc.splitTextToSize(notesCombined, 72);
      const rowHeight = Math.max(10, Math.max(prodLines.length * 4.5, descLines.length * 4.5) + 4);
      
      doc.text(String(idx + 1), 12, yPos + 5);
      doc.text(prodLines, 20, yPos + 5);
      doc.text(qty, 65, yPos + 5);
      doc.text(type, 80, yPos + 5);
      doc.text(descLines, 125, yPos + 5);
      
      yPos += rowHeight;
      doc.line(10, yPos, 200, yPos);
    });
    yPos += 4;
  } else {
    // Legacy single item specifications rendering
    doc.setFont("helvetica", "bold");
    doc.text("Product Name:", 15, 89);
    doc.setFont("helvetica", "normal");
    doc.text(request.product || "-", 55, 89);
    
    doc.setFont("helvetica", "bold");
    doc.text("Quantity Required:", 110, 89);
    doc.setFont("helvetica", "normal");
    doc.text(String(request.quantity || 1), 155, 89);
    
    doc.setFont("helvetica", "bold");
    doc.text("Sample Type:", 15, 96);
    doc.setFont("helvetica", "normal");
    doc.text(request.sampleType || "-", 55, 96);
    
    doc.line(10, 102, 200, 102);
    
    // Description block (Multi-line layout)
    doc.setFont("helvetica", "bold");
    doc.text("Description of Sample / Specifications:", 15, 109);
    doc.setFont("helvetica", "normal");
    const descLines = doc.splitTextToSize(request.description || "-", 175);
    doc.text(descLines, 15, 115);
    
    yPos = 115 + (descLines.length * 5) + 4;
    doc.line(10, yPos, 200, yPos);
    
    // Special Notes block (Multi-line layout)
    doc.setFont("helvetica", "bold");
    doc.text("Special Note:", 15, yPos + 6);
    doc.setFont("helvetica", "normal");
    const noteLines = doc.splitTextToSize(request.specialNotes || "-", 175);
    doc.text(noteLines, 15, yPos + 12);
    
    yPos = yPos + 12 + (noteLines.length * 5) + 4;
    doc.line(10, yPos, 200, yPos);
  }
  
  // Section 3 Header: Workflow Status & Dates
  doc.setFont("helvetica", "bold");
  doc.setFillColor(245, 247, 250);
  doc.rect(10, yPos, 190, 8, "FD");
  doc.text("3. WORKFLOW lifecycle STATUS", 15, yPos + 5.5);
  
  yPos = yPos + 8;
  doc.line(10, yPos, 200, yPos);
  
  doc.setFont("helvetica", "bold");
  doc.text("Current Status:", 15, yPos + 7);
  doc.setFont("helvetica", "normal");
  doc.text(request.status || "-", 55, yPos + 7);
  
  doc.setFont("helvetica", "bold");
  doc.text("Action Required:", 110, yPos + 7);
  doc.setFont("helvetica", "normal");
  doc.text(request.actionRequired || "-", 155, yPos + 7);
  
  doc.setFont("helvetica", "bold");
  doc.text("Date Received by Dev:", 15, yPos + 14);
  doc.setFont("helvetica", "normal");
  doc.text(request.dateReceived || "Awaiting Acceptance", 55, yPos + 14);
  
  doc.setFont("helvetica", "bold");
  doc.text("Planned Delivery Date:", 110, yPos + 14);
  doc.setFont("helvetica", "normal");
  doc.text(request.plannedDeliveryDate || "-", 155, yPos + 14);
  
  doc.setFont("helvetica", "bold");
  doc.text("Actual Completion Date:", 15, yPos + 21);
  doc.setFont("helvetica", "normal");
  doc.text(request.actualCompletionDate || "Pending Completion", 55, yPos + 21);
  
  yPos = yPos + 27;
  doc.line(10, yPos, 200, yPos);
  
  // Section 4 Header: Signatures & Approvals (Bottom aligned)
  const sigY = 238;
  doc.line(10, sigY, 200, sigY);
  
  doc.setFont("helvetica", "bold");
  doc.setFillColor(245, 247, 250);
  doc.rect(10, sigY, 190, 8, "FD");
  doc.text("4. SIGNATURES & SIGN-OFF APPROVALS", 15, sigY + 5.5);
  
  doc.line(10, sigY + 8, 200, sigY + 8);
  
  // Grid column split lines
  doc.line(73, sigY + 8, 73, 287);
  doc.line(136, sigY + 8, 136, 287);
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.text("Prepared By (Marketing / Sales)", 13, sigY + 13);
  doc.text("Accepted By (Sample Development)", 76, sigY + 13);
  doc.text("Completed By (Sample Development)", 139, sigY + 13);
  
  doc.setFont("helvetica", "normal");
  doc.text(`Name: ${request.requestedBy || "-"}`, 13, sigY + 20);
  doc.text(`Name: ${request.processedBy || "Pending"}`, 76, sigY + 20);
  doc.text(`Name: ${request.completedBy || "Pending"}`, 139, sigY + 20);
  
  doc.text(`Date: ${request.requestDate || "-"}`, 13, sigY + 27);
  doc.text(`Date: ${request.dateReceived || "Pending"}`, 76, sigY + 27);
  doc.text(`Date: ${request.actualCompletionDate || "Pending"}`, 139, sigY + 27);
  
  doc.text("Signature: __________________", 13, sigY + 36);
  doc.text("Signature: __________________", 76, sigY + 36);
  doc.text("Signature: __________________", 139, sigY + 36);
  
  // Trigger immediate file download
  doc.save(`Sample_Request_${request.sampleRequestNo || "Draft"}.pdf`);
}
