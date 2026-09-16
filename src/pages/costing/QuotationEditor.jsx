import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as costingService from "../../services/firebase/costingService";
import * as quotationService from "../../services/firebase/quotationService";
import { 
  DEFAULT_FINANCIAL_PARAMS, 
  DEFAULT_COMPANY_DETAILS, 
  DEFAULT_TERMS, 
  DEFAULT_SAVED_PRODUCTS,
  calculateBeddingItem, 
  calculateHorticultureItem, 
  getDisplayPrice 
} from "../../utils/quotationCalculations";
import { generateQuotationExcel } from "../../utils/quotationExcelEngine";
import { downloadQuotationPDF } from "../../utils/quotationPdfGenerator";
import SavedDetailsModal from "./SavedDetailsModal";
import ParametersLogModal from "./ParametersLogModal";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";

registerAllModules();

import { 
  Row, 
  Col, 
  Card, 
  Typography, 
  Button, 
  Tag, 
  Space, 
  Alert, 
  Spin, 
  Radio, 
  InputNumber, 
  Input, 
  message, 
  Tooltip,
  Modal,
  Divider,
  Upload
} from "antd";
import {
  LeftOutlined,
  SaveOutlined,
  DownloadOutlined,
  FilePdfOutlined,
  HistoryOutlined,
  PictureOutlined,
  TableOutlined,
  CheckOutlined,
  EyeOutlined,
  EditOutlined,
  InfoCircleOutlined,
  DeleteOutlined,
  UploadOutlined,
  UserOutlined,
  ReloadOutlined,
  SafetyCertificateOutlined
} from "@ant-design/icons";

const { Title, Text, Paragraph } = Typography;

export default function QuotationEditor() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const templateHotRef = useRef(null);
  const dataEntryHotRef = useRef(null);

  const [request, setRequest] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Active Excel Sheet Tab:
  // "sheet1_bedding" -> Sheet 1: Quotation Format (Bedding)
  // "sheet2_bedding" -> Sheet 2: Data Entry (Bedding)
  // "sheet3_horti"   -> Sheet 3: Quotation Format (Horticulture)
  // "sheet4_horti"   -> Sheet 4: Data Entry (Horticulture)
  const [activeTab, setActiveTab] = useState("sheet1_bedding");

  // Quotation Metadata
  const [category, setCategory] = useState("bedding"); // "bedding" | "horticulture"
  const [quotationNo, setQuotationNo] = useState("");
  const [quotationDate, setQuotationDate] = useState(new Date().toISOString().split("T")[0]);
  const [buyerName, setBuyerName] = useState("");
  const [shipper, setShipper] = useState(DEFAULT_COMPANY_DETAILS);

  // Preference Selectors (Matching Excel S2:Y6 parameters box)
  const [containerSize, setContainerSize] = useState("40ft"); // "20ft" | "40ft"
  const [priceTerm, setPriceTerm] = useState("FOB"); // "FOB" | "EX_WORKS" | "CIF" | "FOB_SEPARATE_CIF"

  // Financial Parameters (Cols R to Y, Rows 2 to 6)
  const [financialParams, setFinancialParams] = useState(DEFAULT_FINANCIAL_PARAMS);

  // Commercial Notes & Terms (Matching exact footer rows)
  const [packing, setPacking] = useState("Coir Sheet/Poly bag/Bundle pack/Pallet-Edit option");
  const [paymentTerms, setPaymentTerms] = useState(DEFAULT_TERMS.paymentTerms);
  const [leadTime, setLeadTime] = useState(DEFAULT_TERMS.leadTime);
  const [validity, setValidity] = useState("");

  // Items List (Directly populated from Costing Request report)
  const [items, setItems] = useState([]);

  // Active Selected Cell indicator for Excel formula bar
  const [activeCellAddress, setActiveCellAddress] = useState("D2");
  const [activeCellValue, setActiveCellValue] = useState("Price Quotation");

  // Modals & Image State
  const [savedModalVisible, setSavedModalVisible] = useState(false);
  const [selectedItemIndex, setSelectedItemIndex] = useState(null);
  const [logsModalVisible, setLogsModalVisible] = useState(false);
  const [previewImage, setPreviewImage] = useState(null);

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const req = await costingService.getCostingRequestById(id);
        setRequest(req);

        // Default validity date (+1 month)
        const vDate = new Date();
        vDate.setMonth(vDate.getMonth() + 1);
        const defaultValidityStr = `Till ${vDate.toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" })} (set 1 month from quotation date)`;
        setValidity(defaultValidityStr);

        // Detect Category based strictly on the Costing Request type
        const reqUnitStr = (req.productUnit || req.productCategory || req.costRequestNo || "").toString().toLowerCase();
        const isHorti = reqUnitStr.includes("hort") || (req.costRequestNo && req.costRequestNo.includes("-H-"));
        const reqCat = isHorti ? "horticulture" : "bedding";
        setCategory(reqCat);
        setActiveTab(reqCat === "bedding" ? "sheet1_bedding" : "sheet3_horti");
        setPacking(reqCat === "bedding" 
          ? "Coir Sheet/Poly bag/Bundle pack/Pallet-Edit option" 
          : "Carton Boxes/Floor load/Pallet-Edit option");

        // Extract auto-populated sales officer details from currentUser profile or request marketingOfficer
        const offName = currentUser?.salesOfficerProfile?.name || currentUser?.displayName || req.marketingOfficer?.name || "Sales & Marketing Officer";
        const offRole = currentUser?.salesOfficerProfile?.designation || currentUser?.designation || "Manager - Sales & Marketing";
        const offPhone = currentUser?.salesOfficerProfile?.contact || req.marketingOfficer?.phone || DEFAULT_COMPANY_DETAILS.phone;
        const offEmail = currentUser?.salesOfficerProfile?.email || currentUser?.email || req.marketingOfficer?.email || "";
        const offSig = currentUser?.salesOfficerProfile?.signatureBase64 || currentUser?.salesOfficerProfile?.signatureUrl || "";

        // Check for existing saved quotation
        const savedQuote = await quotationService.getQuotationByRequestId(id);
        if (savedQuote) {
          setQuotationNo(savedQuote.quotationNo || `PQ-${req.costRequestNo || id}`);
          setQuotationDate(savedQuote.quotationDate || new Date().toISOString().split("T")[0]);
          setBuyerName(savedQuote.buyerName || req.customerName || "Customer");
          
          const savedShipper = savedQuote.shipper || {};
          setShipper({
            ...DEFAULT_COMPANY_DETAILS,
            ...savedShipper,
            signatoryName: savedShipper.signatoryName || offName,
            signatoryRole: savedShipper.signatoryRole || offRole,
            signatoryPhone: savedShipper.signatoryPhone || offPhone,
            signatoryEmail: savedShipper.signatoryEmail || offEmail,
            signatureImage: savedShipper.signatureImage || offSig,
            signatory: savedShipper.signatory || `${savedShipper.signatoryName || offName} (${savedShipper.signatoryRole || offRole})`
          });
          setContainerSize(savedQuote.containerSize || "40ft");
          setPriceTerm(savedQuote.priceTerm || "FOB");
          setFinancialParams(savedQuote.financialParams || DEFAULT_FINANCIAL_PARAMS);
          setCategory(reqCat);
          setPacking(savedQuote.packing || (reqCat === "bedding" 
            ? "Coir Sheet/Poly bag/Bundle pack/Pallet-Edit option" 
            : "Carton Boxes/Floor load/Pallet-Edit option"));
          setPaymentTerms(savedQuote.paymentTerms || DEFAULT_TERMS.paymentTerms);
          setLeadTime(savedQuote.leadTime || DEFAULT_TERMS.leadTime);
          setValidity(savedQuote.validity || defaultValidityStr);
          setItems(savedQuote.items || []);
        } else {
          setQuotationNo(`PQ-${req.costRequestNo || id.slice(-5).toUpperCase()}`);
          setBuyerName(req.customerName || "Customer");
          setShipper({
            ...DEFAULT_COMPANY_DETAILS,
            phone: offPhone,
            signatoryName: offName,
            signatoryRole: offRole,
            signatoryPhone: offPhone,
            signatoryEmail: offEmail,
            signatureImage: offSig,
            signatory: `${offName} (${offRole})`
          });

          let rawItems = [];
          if (Array.isArray(req.specs?.items)) {
            rawItems = req.specs.items;
          } else if (req.specs?.items && typeof req.specs.items === "object") {
            rawItems = Object.values(req.specs.items);
          } else if (req.specs && typeof req.specs === "object") {
            rawItems = [req.specs];
          } else {
            rawItems = [{}];
          }

          const initialItems = rawItems.map((specItem, idx) => {
            const costItem = (req.costing?.items && (req.costing.items[idx] || req.costing.items[String(idx)])) || req.costing || {};
            
            return {
              id: `item-${idx + 1}`,
              description: specItem.description || specItem.productDescription || (reqCat === "bedding" ? `Coir Bedding Item #${idx + 1}` : `FHN095${idx + 4}`),
              specifications: specItem.specifications || specItem.description || (reqCat === "bedding" ? "Standard Rubberized Coir Bedding Sheet" : "30 CM | ROUND WEED DISC | WITH SAME LABEL AND PACKING REQUIREMENTS"),
              imageUrl: specItem.imageUrl || "",
              length: parseFloat(specItem.length || specItem.l) || 100,
              width: parseFloat(specItem.width || specItem.w) || 100,
              height: parseFloat(specItem.height || specItem.h) || 10,
              organic: specItem.organic || "Non-Organic",
              ncRcRatio: specItem.ncRcRatio || specItem.nc_rc || "80:20",
              density: specItem.density || "80 kg/m3",
              qtyPerBundle: parseFloat(specItem.qtyPerBundle || costItem.qtyPerBundle) || 1,
              gsm: specItem.gsm || 800,
              latexRatio: specItem.latexRatio || "80:20",
              packing: parseFloat(costItem.packing || specItem.packing) || 128,
              cartonSize: costItem.cartonSize || specItem.cartonSize || "57X51X58CM",
              palletSize: costItem.palletSize || specItem.palletSize || "TBA",
              bundlesPerPallet: parseFloat(costItem.bundlesPerPallet || specItem.bundlesPerPallet) || 0,
              cartonsPerPallet: parseFloat(costItem.cartonsPerPallet || specItem.cartonsPerPallet) || 16,
              rollDiameter: costItem.rollDiameter || specItem.rollDiameter || "TBA",
              unitCost: parseFloat(costItem.unitCost || specItem.unitCost) || 26.73,
              palletsPer40ft: parseFloat(costItem.palletsPer40ft) || 0,
              palletsPer20ft: parseFloat(costItem.palletsPer20ft) || 0
            };
          });

          setItems(initialItems);
        }
      } catch (err) {
        console.error("Error loading quotation:", err);
        setError("Failed to load costing request details.");
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, [id]);

  // Synchronize Sales Officer profile when currentUser auth state resolves
  useEffect(() => {
    if (currentUser && !loading) {
      setShipper(prev => {
        const isDefault = !prev.signatoryName || prev.signatoryName === "Sales & Marketing Officer" || prev.signatoryName === "Manager - Sales & Marketing";
        if (isDefault) {
          const offName = currentUser.salesOfficerProfile?.name || currentUser.displayName || prev.signatoryName;
          const offRole = currentUser.salesOfficerProfile?.designation || prev.signatoryRole;
          const offPhone = currentUser.salesOfficerProfile?.contact || prev.signatoryPhone || prev.phone;
          const offEmail = currentUser.salesOfficerProfile?.email || currentUser.email || prev.signatoryEmail;
          const offSig = currentUser.salesOfficerProfile?.signatureBase64 || currentUser.salesOfficerProfile?.signatureUrl || prev.signatureImage;
          return {
            ...prev,
            signatoryName: offName,
            signatoryRole: offRole,
            signatoryPhone: offPhone,
            signatoryEmail: offEmail,
            signatureImage: offSig,
            signatory: `${offName} (${offRole})`
          };
        }
        return prev;
      });
    }
  }, [currentUser, loading]);

  // Update Sales Officer / Signatory field
  const handleSignatoryFieldChange = (field, val) => {
    setShipper(prev => {
      const updated = { ...prev, [field]: val };
      if (field === "signatoryName" || field === "signatoryRole") {
        const namePart = updated.signatoryName || "";
        const rolePart = updated.signatoryRole ? `(${updated.signatoryRole})` : "";
        updated.signatory = `${namePart} ${rolePart}`.trim();
      }
      return updated;
    });
  };

  // Reset Sales Officer details to currently logged-in user profile
  const handleResetToMyProfile = () => {
    const offName = currentUser?.salesOfficerProfile?.name || currentUser?.displayName || "Sales & Marketing Officer";
    const offRole = currentUser?.salesOfficerProfile?.designation || "Manager - Sales & Marketing";
    const offPhone = currentUser?.salesOfficerProfile?.contact || DEFAULT_COMPANY_DETAILS.phone;
    const offEmail = currentUser?.salesOfficerProfile?.email || currentUser?.email || "";
    const offSig = currentUser?.salesOfficerProfile?.signatureBase64 || currentUser?.salesOfficerProfile?.signatureUrl || "";

    setShipper(prev => ({
      ...prev,
      signatoryName: offName,
      signatoryRole: offRole,
      signatoryPhone: offPhone,
      signatoryEmail: offEmail,
      signatureImage: offSig,
      signatory: `${offName} (${offRole})`
    }));
    message.success("Sales officer details & signature reset to your profile!");
  };

  // Switch active sheet tab
  const handleTabChange = (newTab) => {
    setActiveTab(newTab);
  };

  // Recalculate items whenever items, category, or financialParams change
  const calculatedItems = items.map(item => {
    if (category === "bedding") {
      return calculateBeddingItem(item, financialParams);
    } else {
      return calculateHorticultureItem(item, financialParams);
    }
  });

  // Update item field and trigger live recalculation
  const updateItemField = (idx, field, value) => {
    setItems(prev => {
      const nextItems = [...prev];
      nextItems[idx] = { ...nextItems[idx], [field]: value };
      return nextItems;
    });
  };

  // Handsontable change handler: synchronizes cell edits across both sheets and items state
  const handleHotChange = (changes, source) => {
    if (!changes || source === "loadData") return;

    setItems(prev => {
      const nextItems = [...prev];
      let hasDiff = false;
      changes.forEach(([row, prop, oldVal, newVal]) => {
        if (row < nextItems.length && oldVal !== newVal) {
          hasDiff = true;
          let cleanVal = newVal;
          if (["length", "width", "height", "qtyPerBundle", "bundlesPerPallet", "cartonsPerPallet", "unitCost", "palletsPer40ft", "palletsPer20ft", "packing", "gsm"].includes(prop)) {
            if (typeof cleanVal === "string") {
              cleanVal = parseFloat(cleanVal.replace(/[^0-9.-]+/g, "")) || 0;
            }
          }
          nextItems[row] = {
            ...nextItems[row],
            [prop]: cleanVal
          };
        }
      });
      return hasDiff ? nextItems : prev;
    });
  };

  // Immediate parameter change for real-time live formula recalculation
  const handleImmediateParamChange = (paramKey, newVal) => {
    if (newVal === null || newVal === undefined || isNaN(newVal)) return;
    setFinancialParams(prev => ({
      ...prev,
      [paramKey]: newVal
    }));
  };

  // Commit parameter change with audit logging
  const handleParamCommit = async (paramKey, paramLabel) => {
    const currentVal = financialParams[paramKey];
    try {
      await quotationService.logParameterChange({
        requestId: id,
        costRequestNo: request?.costRequestNo || id,
        user: {
          uid: currentUser?.uid || "mock-user",
          name: currentUser?.displayName || currentUser?.email?.split("@")[0] || "User",
          email: currentUser?.email || "user@example.com",
          role: currentUser?.costingRole || currentUser?.role || "Marketing"
        },
        paramName: paramLabel,
        newValue: currentVal,
        reason: `Updated ${paramLabel} in Price Quotation Suite`
      });
    } catch (logErr) {
      console.warn("Audit log error:", logErr);
    }
  };

  // Save Quotation State
  const handleSaveQuotation = async () => {
    try {
      setSaving(true);
      const payload = {
        quotationNo,
        quotationDate,
        buyerName,
        shipper,
        category,
        containerSize,
        priceTerm,
        financialParams,
        packing,
        paymentTerms,
        leadTime,
        validity,
        items,
        costRequest: {
          id: request.id,
          costRequestNo: request.costRequestNo,
          requestDate: request.requestDate,
          completionDate: request.completionDate,
          status: request.status,
          marketingOfficer: request.marketingOfficer,
          financeOfficer: request.financeOfficer
        }
      };

      await quotationService.saveQuotation(id, payload, currentUser);
      message.success("Price Quotation saved successfully!");
    } catch (err) {
      console.error(err);
      message.error("Failed to save quotation.");
    } finally {
      setSaving(false);
    }
  };

  // Excel Export
  const handleExportExcel = async () => {
    try {
      const payload = {
        quotationNo,
        quotationDate,
        buyerName,
        shipper,
        category,
        containerSize,
        priceTerm,
        financialParams,
        packing,
        paymentTerms,
        leadTime,
        validity,
        items: calculatedItems,
        costRequest: request
      };
      await generateQuotationExcel(payload);
      message.success("Price Quotation Excel (.xlsx) generated successfully!");
    } catch (err) {
      console.error(err);
      message.error("Failed to generate Excel file.");
    }
  };

  // PDF Export
  const handleExportPDF = async () => {
    try {
      const payload = {
        quotationNo,
        quotationDate,
        buyerName,
        shipper,
        category,
        containerSize,
        priceTerm,
        financialParams,
        packing,
        paymentTerms,
        leadTime,
        validity,
        items: calculatedItems
      };
      await downloadQuotationPDF(payload);
      message.success("Price Quotation PDF (Black & White Landscape) generated successfully!");
    } catch (err) {
      console.error(err);
      message.error("Failed to generate PDF.");
    }
  };

  // Apply Preset from Catalog (Images & Specs)
  const handlePresetSelect = (preset) => {
    if (selectedItemIndex === null) return;
    
    setItems(prev => {
      const updated = [...prev];
      const target = { ...updated[selectedItemIndex] };
      target.description = preset.description || preset.name || target.description;
      target.specifications = preset.specifications || preset.description || target.specifications;
      target.imageUrl = preset.imageUrl || target.imageUrl;
      if (preset.length) target.length = preset.length;
      if (preset.width) target.width = preset.width;
      if (preset.height) target.height = preset.height;
      if (preset.cartonSize) target.cartonSize = preset.cartonSize;
      if (preset.packing) target.packing = preset.packing;
      if (preset.palletSize) target.palletSize = preset.palletSize;
      if (preset.bundlesPerPallet) target.bundlesPerPallet = preset.bundlesPerPallet;
      if (preset.cartonsPerPallet) target.cartonsPerPallet = preset.cartonsPerPallet;
      if (preset.gsm) target.gsm = preset.gsm;
      if (preset.latexRatio) target.latexRatio = preset.latexRatio;
      updated[selectedItemIndex] = target;
      return updated;
    });

    message.success(`Preset "${preset.name || preset.description}" applied to item #${selectedItemIndex + 1}!`);
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "100px 0" }}>
        <Spin size="large" tip="Loading Price Quotation Suite..." />
      </div>
    );
  }

  const isCompleted = request?.status === "Costing Completed" || request?.status === "Sent to Marketing";

  if (!isCompleted) {
    return (
      <div style={{ padding: "40px 0", maxWidth: 700, margin: "0 auto" }}>
        <Card style={{ borderRadius: 12, borderLeft: "4px solid #f59e0b", textAlign: "center" }}>
          <Title level={3} style={{ color: "#b45309" }}>Costing Not Completed</Title>
          <Paragraph style={{ fontSize: "1rem", color: "#475569" }}>
            Price Quotations can only be generated once the Costing Request details have been fully completed by Finance.
          </Paragraph>
          <Tag color="warning" style={{ fontSize: "0.9rem", padding: "4px 10px", marginBottom: 20 }}>
            Current Status: {request?.status || "In Progress"}
          </Tag>
          <div>
            <Button
              type="primary"
              icon={<LeftOutlined />}
              onClick={() => navigate(`/costing-requests/${id}`)}
              size="large"
              style={{ borderRadius: 8, background: "#0284c7" }}
            >
              Back to Request Details
            </Button>
          </div>
        </Card>
      </div>
    );
  }

  const isBedding = category === "bedding";

  // Excel Styling Design Tokens
  const excelGridBorder = "1px solid #d4d4d4";
  const excelHeaderBg = "#0284c7";
  const excelDarkHeader = "#0f172a";
  const excelRowIdxBg = "#f1f5f9";
  const excelGreen = "#107c41";

  // Tab definitions filtered strictly by the Costing Request category
  const sheetsList = isBedding ? [
    { key: "sheet1_bedding", label: "Quotation Format", sheetNum: "Sheet 1", color: "#0284c7" },
    { key: "sheet2_bedding", label: "Data Entry", sheetNum: "Sheet 2", color: "#0369a1" }
  ] : [
    { key: "sheet3_horti", label: "Quotation Format", sheetNum: "Sheet 3", color: "#059669" },
    { key: "sheet4_horti", label: "Data Entry", sheetNum: "Sheet 4", color: "#047857" }
  ];

  // Custom Handsontable Image Renderer (supports preview, upload, preset selection, and delete)
  const imageRenderer = (instance, td, row, col, prop, value) => {
    while (td.firstChild) {
      td.removeChild(td.firstChild);
    }
    
    td.className = "htCenter htMiddle";
    td.style.padding = "4px";

    const wrapper = document.createElement("div");
    wrapper.style.display = "flex";
    wrapper.style.alignItems = "center";
    wrapper.style.justifyContent = "center";
    wrapper.style.gap = "4px";

    if (value) {
      const img = document.createElement("img");
      img.src = value;
      img.style.width = "40px";
      img.style.height = "40px";
      img.style.objectFit = "cover";
      img.style.borderRadius = "4px";
      img.style.border = "1px solid #cbd5e1";
      img.style.cursor = "pointer";
      img.title = "Click to preview image";
      img.onclick = (e) => {
        e.stopPropagation();
        setPreviewImage(value);
      };
      wrapper.appendChild(img);

      const delBtn = document.createElement("button");
      delBtn.innerHTML = "×";
      delBtn.title = "Delete / Remove image";
      delBtn.style.cssText = "background:#ef4444;color:#ffffff;border:none;border-radius:50%;width:18px;height:18px;font-size:12px;font-weight:bold;cursor:pointer;display:flex;align-items:center;justify-content:center;line-height:1;";
      delBtn.onclick = (e) => {
        e.stopPropagation();
        updateItemField(row, "imageUrl", "");
        message.info("Image removed.");
      };
      wrapper.appendChild(delBtn);
    } else {
      const presetBtn = document.createElement("button");
      presetBtn.innerText = "Preset";
      presetBtn.title = "Choose preset from library";
      presetBtn.style.cssText = "background:#f0f9ff;border:1px dashed #0284c7;color:#0284c7;font-weight:700;border-radius:4px;padding:3px 6px;font-size:11px;cursor:pointer;";
      presetBtn.onclick = (e) => {
        e.stopPropagation();
        setSelectedItemIndex(row);
        setSavedModalVisible(true);
      };
      wrapper.appendChild(presetBtn);

      const uploadBtn = document.createElement("button");
      uploadBtn.innerText = "Upload";
      uploadBtn.title = "Upload image file";
      uploadBtn.style.cssText = "background:#ffffff;border:1px solid #cbd5e1;color:#475569;border-radius:4px;padding:3px 6px;font-size:11px;cursor:pointer;";
      uploadBtn.onclick = (e) => {
        e.stopPropagation();
        const input = document.createElement("input");
        input.type = "file";
        input.accept = "image/*";
        input.onchange = (ev) => {
          const file = ev.target.files[0];
          if (file) {
            const reader = new FileReader();
            reader.onload = (re) => {
              updateItemField(row, "imageUrl", re.target.result);
              message.success("Image uploaded!");
            };
            reader.readAsDataURL(file);
          }
        };
        input.click();
      };
      wrapper.appendChild(uploadBtn);
    }

    td.appendChild(wrapper);
    return td;
  };

  // Custom Formula Renderer with badge & formula indicator
  const formulaRenderer = (instance, td, row, col, prop, value) => {
    td.className = "htCenter htMiddle";
    td.style.background = "#f8fafc";
    td.style.color = "#0f172a";
    td.style.fontWeight = "600";
    if (typeof value === "number") {
      td.innerText = value.toLocaleString();
    } else {
      td.innerText = value || "0";
    }
    td.title = "Formula auto-calculated cell";
    return td;
  };

  // Custom Price Renderer for highlighted quotation price column
  const priceRenderer = (instance, td, row, col, prop, value) => {
    td.className = "htCenter htMiddle";
    td.style.background = "#eff6ff";
    td.style.color = "#0284c7";
    td.style.fontWeight = "800";
    td.style.fontSize = "13px";
    td.innerText = value || "-";
    td.title = `Active Price: ${priceTerm} (${containerSize})`;
    return td;
  };

  // Cell Selection Handler to display exact Excel coordinates and formula expressions in fx Formula Bar
  const handleCellSelection = (row, col) => {
    const colLetters = ["A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M", "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z"];
    const excelRow = row + 10; // Excel data rows begin at Row 10
    const colLetter = colLetters[col] || "A";
    const cellAddr = `${colLetter}${excelRow}`;
    setActiveCellAddress(cellAddr);

    const item = calculatedItems[row];
    if (!item) return;

    if (activeTab === "sheet1_bedding") {
      // Bedding Sheet 1 Columns:
      // 0: idx (A), 1: image (B), 2: spec (C), 3: L (D), 4: W (E), 5: H (F), 6: organic (G), 7: ncrc (H), 8: density (I), 9: qtyPerBdl (J),
      // 10: pltSize (K), 11: bdlPlt (L), 12: plts40 (M), 13: plts20 (N), 14: price (O), 15: bdl20 (P), 16: bdl40 (Q), 17: qty40 (R), 18: qty20 (S)
      switch (col) {
        case 14: // O - Quoted Price
          setActiveCellValue(`=IF($V$4="FOB", IF($V$2="20 ft price", U${excelRow}, T${excelRow}), IF($V$4="EX works", X${excelRow}, IF($V$4="CIF", IF($V$2="20 ft price", W${excelRow}, V${excelRow}), T${excelRow}))) -> [${getDisplayPrice(item, priceTerm, containerSize, financialParams.cifRate).label}]`);
          break;
        case 15: // P - Bundles per 20ft
          setActiveCellValue(item.bundlesPerPallet > 0 && item.palletsPer20ft > 0 ? `=N${excelRow}*L${excelRow} [${item.bundlesPer20ft}]` : `=ROUND(27/CBM/J${excelRow},0) [${item.bundlesPer20ft}]`);
          break;
        case 16: // Q - Bundles per 40ft
          setActiveCellValue(item.bundlesPerPallet > 0 && item.palletsPer40ft > 0 ? `=M${excelRow}*L${excelRow} [${item.bundlesPer40ft}]` : `=ROUND(67/CBM/J${excelRow},0) [${item.bundlesPer40ft}]`);
          break;
        case 17: // R - Qty per 40ft
          setActiveCellValue(item.bundlesPerPallet > 0 && item.palletsPer40ft > 0 ? `=M${excelRow}*L${excelRow}*J${excelRow} [${item.qtyPer40ft.toLocaleString()}]` : `=Q${excelRow}*J${excelRow} [${item.qtyPer40ft.toLocaleString()}]`);
          break;
        case 18: // S - Qty per 20ft
          setActiveCellValue(item.bundlesPerPallet > 0 && item.palletsPer20ft > 0 ? `=N${excelRow}*L${excelRow}*J${excelRow} [${item.qtyPer20ft.toLocaleString()}]` : `=P${excelRow}*J${excelRow} [${item.qtyPer20ft.toLocaleString()}]`);
          break;
        default:
          {
            const colDef = beddingTemplateHotColumns[col];
            const val = item[colDef?.data] !== undefined ? item[colDef.data] : "";
            setActiveCellValue(String(val));
          }
      }
    } else if (activeTab === "sheet3_horti") {
      // Horti Sheet 3 Columns:
      // 0: idx (A), 1: image (B), 2: spec (C), 3: pack (D), 4: pltSize (E), 5: ctnPlt (F), 6: plts40 (G), 7: plts20 (H), 8: ctnSize (I),
      // 9: price (J), 10: bdl20 (K), 11: bdl40 (L), 12: ctn40 (M), 13: qty40 (N), 14: ctn20 (O), 15: qty20 (P)
      switch (col) {
        case 9: // J - Quoted Price
          setActiveCellValue(`=IF($V$4="FOB", IF($V$2="20 ft price", S${excelRow}, R${excelRow}), IF($V$4="EX works", V${excelRow}, IF($V$4="CIF", IF($V$2="20 ft price", U${excelRow}, T${excelRow}), R${excelRow}))) -> [${getDisplayPrice(item, priceTerm, containerSize, financialParams.cifRate).label}]`);
          break;
        case 12: // M - Cartons per 40ft
          setActiveCellValue(item.cartonsPerPallet > 0 && item.palletsPer40ft > 0 ? `=G${excelRow}*F${excelRow} [${item.cartonsPer40ft}]` : `=L${excelRow} [${item.cartonsPer40ft}]`);
          break;
        case 13: // N - Qty per 40ft
          setActiveCellValue(`=M${excelRow}*D${excelRow} [${item.qtyPer40ft.toLocaleString()}]`);
          break;
        case 14: // O - Cartons per 20ft
          setActiveCellValue(item.cartonsPerPallet > 0 && item.palletsPer20ft > 0 ? `=H${excelRow}*F${excelRow} [${item.cartonsPer20ft}]` : `=K${excelRow} [${item.cartonsPer20ft}]`);
          break;
        case 15: // P - Qty per 20ft
          setActiveCellValue(`=O${excelRow}*D${excelRow} [${item.qtyPer20ft.toLocaleString()}]`);
          break;
        default:
          {
            const colDef = hortiTemplateHotColumns[col];
            const val = item[colDef?.data] !== undefined ? item[colDef.data] : "";
            setActiveCellValue(String(val));
          }
      }
    } else {
      // Sheet 2 / Sheet 4 Data Entry
      const colDefs = activeTab === "sheet2_bedding" ? beddingDataEntryHotColumns : hortiDataEntryHotColumns;
      const colDef = colDefs[col];
      const val = item[colDef?.data] !== undefined ? item[colDef.data] : "";
      setActiveCellValue(String(val));
    }
  };

  // Prepare Data for Handsontable in Quotation Format Template (Sheet 1 & 3)
  const templateHotData = calculatedItems.map((item, idx) => {
    const dispPrice = getDisplayPrice(item, priceTerm, containerSize, financialParams.cifRate);
    return {
      idx: idx + 1,
      quotedPrice: dispPrice.label,
      ...item
    };
  });

  // Prepare Data for Handsontable in Data Entry Backend (Sheet 2 & 4)
  const dataEntryHotData = calculatedItems.map((item, idx) => ({
    idx: idx + 1,
    ...item
  }));

  // Handsontable Columns for Sheet 1: Quatation fomat Bedding
  const beddingTemplateHotColumns = [
    { data: "idx", title: "#", readOnly: true, width: 45, className: "htCenter htMiddle" },
    { data: "imageUrl", title: "Image", renderer: imageRenderer, readOnly: true, width: 140 },
    { data: "description", title: "Product spec", width: 220, className: "htLeft htMiddle" },
    { data: "length", title: "L (CM)", type: "numeric", width: 75, className: "htCenter htMiddle" },
    { data: "width", title: "W (CM)", type: "numeric", width: 75, className: "htCenter htMiddle" },
    { data: "height", title: "H (CM)", type: "numeric", width: 75, className: "htCenter htMiddle" },
    { data: "organic", title: "Organic/Non Org", type: "dropdown", source: ["Non-Organic", "Organic", "100% Organic"], width: 120, className: "htCenter htMiddle" },
    { data: "ncRcRatio", title: "NC/RC Ratio", type: "dropdown", source: ["80:20", "70:30", "100:0", "60:40", "50:50"], width: 105, className: "htCenter htMiddle" },
    { data: "density", title: "Density", type: "dropdown", source: ["80 kg/m3", "100 kg/m3", "65 kg/m3", "120 kg/m3", "70 kg/m3"], width: 100, className: "htCenter htMiddle" },
    { data: "qtyPerBundle", title: "Qty per BUNDLE", type: "numeric", width: 110, className: "htCenter htMiddle" },
    { data: "palletSize", title: "Pallet size", width: 100, className: "htCenter htMiddle" },
    { data: "bundlesPerPallet", title: "Bundles per pallet", type: "numeric", width: 120, className: "htCenter htMiddle" },
    { data: "palletsPer40ft", title: "Pallets per 40ft", type: "numeric", width: 110, className: "htCenter htMiddle" },
    { data: "palletsPer20ft", title: "Pallets per 20ft", type: "numeric", width: 110, className: "htCenter htMiddle" },
    { data: "quotedPrice", title: "Price FOB /cif/Ex works", renderer: priceRenderer, readOnly: true, width: 140 },
    { data: "bundlesPer20ft", title: "Bundles per 20ft", renderer: formulaRenderer, readOnly: true, width: 105 },
    { data: "bundlesPer40ft", title: "Bundles per 40ft", renderer: formulaRenderer, readOnly: true, width: 105 },
    { data: "qtyPer40ft", title: "Qty per 40ft", renderer: formulaRenderer, readOnly: true, width: 110 },
    { data: "qtyPer20ft", title: "Qty per 20ft", renderer: formulaRenderer, readOnly: true, width: 110 }
  ];

  const beddingNestedHeaders = [
    [
      "#", "Image", "Product spec", "L (CM)", "W (CM)", "H (CM)", "Organic/Non Org", "NC/RC Ratio", "Density", "Qty per BUNDLE", "Pallet size", "Bundles per pallet", "Pallets per 40ft", "Pallets per 20ft", "Price FOB /cif/Ex works", "Bundles per 20ft", "Bundles per 40ft", "Qty per 40ft", "Qty per 20ft"
    ],
    [
      "#", "Images common", "As per cost req data", "100 (As per req)", "100 (As per req)", "10 (As per req)", "Organic/Non-Org", "80:20 (As per req)", "80 kg/m3", "As per req", "If applicable", "AS per cost req", "Marketing to fill", "Marketing to fill", "Auto calculated price", "Auto cal", "Auto cal", "Auto pick", "Auto pick"
    ]
  ];

  // Handsontable Columns for Sheet 3: Quatation fomat horti
  const hortiTemplateHotColumns = [
    { data: "idx", title: "#", readOnly: true, width: 45, className: "htCenter htMiddle" },
    { data: "imageUrl", title: "Image", renderer: imageRenderer, readOnly: true, width: 140 },
    { data: "description", title: "Product spec", width: 240, className: "htLeft htMiddle" },
    { data: "packing", title: "Packing /Pcs ", type: "numeric", width: 110, className: "htCenter htMiddle" },
    { data: "palletSize", title: "Pallet size", width: 100, className: "htCenter htMiddle" },
    { data: "cartonsPerPallet", title: "Cartons per pallet", type: "numeric", width: 120, className: "htCenter htMiddle" },
    { data: "palletsPer40ft", title: "Pallets per 40ft", type: "numeric", width: 110, className: "htCenter htMiddle" },
    { data: "palletsPer20ft", title: "Pallets per 20ft", type: "numeric", width: 110, className: "htCenter htMiddle" },
    { data: "cartonSize", title: "Carton Size CM", width: 125, className: "htCenter htMiddle" },
    { data: "quotedPrice", title: "Price FOB /cif/Ex works", renderer: priceRenderer, readOnly: true, width: 140 },
    { data: "bundlesPer20ft", title: "Bundles per 20ft", type: "numeric", width: 105, className: "htCenter htMiddle" },
    { data: "bundlesPer40ft", title: "Bundles per 40ft", type: "numeric", width: 105, className: "htCenter htMiddle" },
    { data: "cartonsPer40ft", title: "Cartons per 40ft", renderer: formulaRenderer, readOnly: true, width: 110 },
    { data: "qtyPer40ft", title: "Qty per 40ft", renderer: formulaRenderer, readOnly: true, width: 110 },
    { data: "cartonsPer20ft", title: "Cartons per 20ft", renderer: formulaRenderer, readOnly: true, width: 110 },
    { data: "qtyPer20ft", title: "Qty per 20ft", renderer: formulaRenderer, readOnly: true, width: 110 }
  ];

  const hortiNestedHeaders = [
    [
      "#", "Image", "Product spec", "Packing /Pcs ", "Pallet size", "Cartons per pallet", "Pallets per 40ft", "Pallets per 20ft", "Carton Size CM", "Price FOB /cif/Ex works", "Bundles per 20ft", "Bundles per 40ft", "Cartons per 40ft", "Qty per 40ft", "Cartons per 20ft", "Qty per 20ft"
    ],
    [
      "#", "Images common", "As per cost req data", "AS per cost req", "If applicable", "AS per cost req", "Marketing to fill", "Marketing to fill", "100X100X50 (As per req)", "Auto calculated price", "Manual entry", "Manual entry", "Auto pick", "Auto pick", "Auto pick", "Auto pick"
    ]
  ];

  // Handsontable Columns for Sheet 2: Data entry for Bedding
  const beddingDataEntryHotColumns = [
    { data: "idx", title: "#", readOnly: true, width: 45, className: "htCenter htMiddle" },
    { data: "description", title: "Description", width: 170, className: "htLeft htMiddle" },
    { data: "organic", title: "Organic/Non Org", width: 110, className: "htCenter htMiddle" },
    { data: "length", title: "L (CM)", type: "numeric", width: 75, className: "htCenter htMiddle" },
    { data: "width", title: "W (CM)", type: "numeric", width: 75, className: "htCenter htMiddle" },
    { data: "height", title: "H (CM)", type: "numeric", width: 75, className: "htCenter htMiddle" },
    { data: "ncRcRatio", title: "NC/RC Ratio", width: 95, className: "htCenter htMiddle" },
    { data: "density", title: "Density", width: 90, className: "htCenter htMiddle" },
    { data: "qtyPerBundle", title: "Qty/BUNDLE", type: "numeric", width: 95, className: "htCenter htMiddle" },
    { data: "palletSize", title: "Pallet size", width: 95, className: "htCenter htMiddle" },
    { data: "bundlesPerPallet", title: "Bundles per pallet", type: "numeric", width: 115, className: "htCenter htMiddle" },
    { data: "unitCost", title: "Unit Cost (Fin)", type: "numeric", numericFormat: { pattern: "$0,0.00" }, width: 110, className: "htCenter htMiddle" },
    { data: "palletsPer40ft", title: "Pallets (40ft)", type: "numeric", width: 100, className: "htCenter htMiddle" },
    { data: "palletsPer20ft", title: "Pallets (20ft)", type: "numeric", width: 100, className: "htCenter htMiddle" },
    { data: "bundlesPer20ft", title: "Bundles 20ft", readOnly: true, width: 95, className: "htCenter htMiddle" },
    { data: "bundlesPer40ft", title: "Bundles 40ft", readOnly: true, width: 95, className: "htCenter htMiddle" },
    { data: "qtyPer40ft", title: "Qty per 40ft", readOnly: true, type: "numeric", numericFormat: { pattern: "0,0" }, width: 100, className: "htCenter htMiddle htBold" },
    { data: "qtyPer20ft", title: "Qty per 20ft", readOnly: true, type: "numeric", numericFormat: { pattern: "0,0" }, width: 100, className: "htCenter htMiddle htBold" },
    { data: "fobPrice40ft", title: "FOB Price (40ft)", readOnly: true, type: "numeric", numericFormat: { pattern: "$0,0.0000" }, width: 115, className: "htCenter htMiddle" },
    { data: "fobPrice20ft", title: "FOB Price (20ft)", readOnly: true, type: "numeric", numericFormat: { pattern: "$0,0.0000" }, width: 115, className: "htCenter htMiddle" },
    { data: "cifPrice40ft", title: "CIF Price (40ft)", readOnly: true, type: "numeric", numericFormat: { pattern: "$0,0.0000" }, width: 115, className: "htCenter htMiddle" },
    { data: "cifPrice20ft", title: "CIF Price (20ft)", readOnly: true, type: "numeric", numericFormat: { pattern: "$0,0.0000" }, width: 115, className: "htCenter htMiddle" },
    { data: "exWorksPrice", title: "Ex work price", readOnly: true, type: "numeric", numericFormat: { pattern: "0,0.00" }, width: 105, className: "htCenter htMiddle" }
  ];

  // Handsontable Columns for Sheet 4: Data entry for Horti
  const hortiDataEntryHotColumns = [
    { data: "idx", title: "#", readOnly: true, width: 45, className: "htCenter htMiddle" },
    { data: "description", title: "Product Description (Mkt)", width: 160, className: "htLeft htMiddle" },
    { data: "specifications", title: "Product Specifications (Mkt)", width: 230, className: "htLeft htMiddle" },
    { data: "gsm", title: "GSM (Mkt)", width: 85, className: "htCenter htMiddle" },
    { data: "latexRatio", title: "Latex Ratio (Mkt)", width: 95, className: "htCenter htMiddle" },
    { data: "packing", title: "Packing (Pcs/Ctn)", type: "numeric", width: 110, className: "htCenter htMiddle" },
    { data: "cartonSize", title: "Carton Size (CM)", width: 115, className: "htCenter htMiddle" },
    { data: "palletSize", title: "Pallet size", width: 95, className: "htCenter htMiddle" },
    { data: "cartonsPerPallet", title: "Cartons/pallet", type: "numeric", width: 105, className: "htCenter htMiddle" },
    { data: "rollDiameter", title: "Roll diameter", width: 95, className: "htCenter htMiddle" },
    { data: "unitCost", title: "Unit Cost (Fin)", type: "numeric", numericFormat: { pattern: "$0,0.00" }, width: 110, className: "htCenter htMiddle" },
    { data: "palletsPer40ft", title: "Pallets (40ft)", type: "numeric", width: 100, className: "htCenter htMiddle" },
    { data: "palletsPer20ft", title: "Pallets (20ft)", type: "numeric", width: 100, className: "htCenter htMiddle" },
    { data: "cartonsPer20ft", title: "Cartons 20ft", readOnly: true, width: 100, className: "htCenter htMiddle" },
    { data: "cartonsPer40ft", title: "Cartons 40ft", readOnly: true, width: 100, className: "htCenter htMiddle" },
    { data: "qtyPer40ft", title: "Qty per 40ft", readOnly: true, type: "numeric", numericFormat: { pattern: "0,0" }, width: 100, className: "htCenter htMiddle htBold" },
    { data: "qtyPer20ft", title: "Qty per 20ft", readOnly: true, type: "numeric", numericFormat: { pattern: "0,0" }, width: 100, className: "htCenter htMiddle htBold" },
    { data: "fobPrice40ft", title: "FOB Price (40ft)", readOnly: true, type: "numeric", numericFormat: { pattern: "$0,0.0000" }, width: 115, className: "htCenter htMiddle" },
    { data: "fobPrice20ft", title: "FOB Price (20ft)", readOnly: true, type: "numeric", numericFormat: { pattern: "$0,0.0000" }, width: 115, className: "htCenter htMiddle" },
    { data: "cifPrice40ft", title: "CIF Price (40ft)", readOnly: true, type: "numeric", numericFormat: { pattern: "$0,0.0000" }, width: 115, className: "htCenter htMiddle" },
    { data: "cifPrice20ft", title: "CIF Price (20ft)", readOnly: true, type: "numeric", numericFormat: { pattern: "$0,0.0000" }, width: 115, className: "htCenter htMiddle" },
    { data: "exWorksPrice", title: "Ex work price", readOnly: true, type: "numeric", numericFormat: { pattern: "0,0.00" }, width: 105, className: "htCenter htMiddle" }
  ];

  return (
    <div style={{ fontFamily: "Segoe UI, -apple-system, BlinkMacSystemFont, Roboto, sans-serif", paddingBottom: 60, background: "#f8fafc", minHeight: "100vh" }}>
      
      {/* 1. TOP EXCEL RIBBON & ACTIONS */}
      <div style={{ background: "#ffffff", borderBottom: "1px solid #e2e8f0", padding: "12px 20px", marginBottom: 16, boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <Row justify="space-between" align="middle" gutter={[12, 12]}>
          <Col>
            <Space size="middle" wrap>
              <Button
                icon={<LeftOutlined />}
                onClick={() => navigate(`/costing-requests/${id}`)}
                style={{ borderRadius: 6 }}
              >
                Back to Request
              </Button>

              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 32, height: 32, borderRadius: 6, background: excelGreen, display: "flex", alignItems: "center", justifyContent: "center", color: "#ffffff", fontWeight: 900, fontSize: 18 }}>
                  X
                </div>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <span style={{ fontWeight: 800, fontSize: "1.1rem", color: "#0f172a", lineHeight: 1.2 }}>
                      Price Quotation Suite
                    </span>
                    <Tag color={isBedding ? "geekblue" : "cyan"} style={{ fontWeight: 800, fontSize: "0.75rem", margin: 0 }}>
                      {isBedding ? "BEDDING" : "HORTICULTURE"}
                    </Tag>
                  </div>
                  <div style={{ fontSize: "0.75rem", color: "#64748b", marginTop: 2 }}>
                    Cost Request <strong style={{ color: "#0284c7" }}>#{request?.costRequestNo}</strong> • Customer: <strong>{buyerName || request?.customerName}</strong>
                  </div>
                </div>
              </div>
            </Space>
          </Col>

          <Col>
            <Space wrap>
              <Button
                icon={<HistoryOutlined />}
                onClick={() => setLogsModalVisible(true)}
                style={{ borderRadius: 6, borderColor: "#8b5cf6", color: "#8b5cf6" }}
              >
                Audit Log
              </Button>

              <Button
                icon={<DownloadOutlined />}
                onClick={handleExportExcel}
                style={{ borderRadius: 6, borderColor: "#10b981", color: "#10b981", fontWeight: 600 }}
              >
                Export Excel (.xlsx)
              </Button>

              <Button
                icon={<FilePdfOutlined />}
                onClick={handleExportPDF}
                style={{ borderRadius: 6, borderColor: "#000000", color: "#000000", fontWeight: 600 }}
              >
                Export PDF (B&W Landscape)
              </Button>

              <Button
                type="primary"
                icon={<SaveOutlined />}
                onClick={handleSaveQuotation}
                loading={saving}
                style={{ 
                  borderRadius: 6, 
                  background: "linear-gradient(135deg, #107c41 0%, #0d6535 100%)", 
                  borderColor: "#107c41",
                  fontWeight: 700 
                }}
              >
                Save Quotation
              </Button>
            </Space>
          </Col>
        </Row>
      </div>

      {error && <Alert message={error} type="error" showIcon style={{ margin: "0 20px 16px", borderRadius: 6 }} />}

      {/* 2. EXCEL WORKBOOK SHEET TABS (TOP BAR) */}
      <div style={{ padding: "0 20px", marginBottom: -1 }}>
        <div style={{ display: "flex", gap: 4, overflowX: "auto", borderBottom: "1px solid #cbd5e1" }}>
          {sheetsList.map((sheet) => {
            const isActive = activeTab === sheet.key;
            return (
              <button
                key={sheet.key}
                onClick={() => handleTabChange(sheet.key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  padding: "10px 18px",
                  background: isActive ? "#ffffff" : "#e2e8f0",
                  color: isActive ? sheet.color : "#475569",
                  border: "1px solid #cbd5e1",
                  borderBottom: isActive ? "2px solid #ffffff" : "1px solid #cbd5e1",
                  borderTop: isActive ? `3px solid ${sheet.color}` : "1px solid #cbd5e1",
                  borderRadius: "6px 6px 0 0",
                  fontWeight: isActive ? 800 : 600,
                  fontSize: "0.85rem",
                  cursor: "pointer",
                  position: "relative",
                  top: 1,
                  zIndex: isActive ? 2 : 1,
                  transition: "all 0.15s ease"
                }}
              >
                <TableOutlined style={{ fontSize: 14 }} />
                <span>{sheet.sheetNum}: {sheet.label}</span>
                {isActive && <span style={{ width: 6, height: 6, borderRadius: "50%", background: sheet.color }} />}
              </button>
            );
          })}
        </div>
      </div>

      {/* 3. EXCEL FORMULA BAR & ACTIVE CELL COORDINATOR */}
      <div style={{ margin: "0 20px 12px", background: "#ffffff", border: "1px solid #cbd5e1", padding: "6px 12px", display: "flex", alignItems: "center", gap: 12, fontSize: "0.85rem" }}>
        <div style={{ minWidth: 60, fontWeight: 700, color: "#0f172a", borderRight: "1px solid #e2e8f0", paddingRight: 8 }}>
          {activeCellAddress}
        </div>
        <div style={{ color: "#94a3b8", fontWeight: 700, fontStyle: "italic" }}>
          fx
        </div>
        <div style={{ flex: 1, color: "#334155", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
          {activeCellValue}
        </div>
        <Tag color="green" style={{ fontSize: 11, margin: 0 }}>Active Sheet: {sheetsList.find(s => s.key === activeTab)?.label}</Tag>
      </div>

      {/* 4. MAIN EXCEL SPREADSHEET CANVAS */}
      <div style={{ margin: "0 20px" }}>
        
        {/* ========================================================================= */}
        {/* SHEET 1 & SHEET 3: HANDSONTABLE QUOTATION FORMAT TEMPLATE VIEW             */}
        {/* ========================================================================= */}
        {(activeTab === "sheet1_bedding" || activeTab === "sheet3_horti") && (
          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0 4px 4px 4px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            
            {/* Top Parameters Quick Control Strip with Real-Time Financial Modifiers */}
            <div style={{ background: "#f8fafc", padding: "10px 16px", borderBottom: excelGridBorder }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 8 }}>
                <Space size="middle" wrap>
                  <Text strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>Active Price Term:</Text>
                  <Radio.Group 
                    value={priceTerm} 
                    onChange={(e) => setPriceTerm(e.target.value)} 
                    buttonStyle="solid"
                    size="small"
                  >
                    <Radio.Button value="FOB">FOB</Radio.Button>
                    <Radio.Button value="EX_WORKS">EX Works</Radio.Button>
                    <Radio.Button value="CIF">CIF</Radio.Button>
                    <Radio.Button value="FOB_SEPARATE_CIF">FOB with separate CIF</Radio.Button>
                  </Radio.Group>
                  
                  <Divider type="vertical" />
                  
                  <Text strong style={{ fontSize: "0.85rem", color: "#0f172a" }}>Container:</Text>
                  <Radio.Group 
                    value={containerSize} 
                    onChange={(e) => setContainerSize(e.target.value)} 
                    buttonStyle="solid"
                    size="small"
                  >
                    <Radio.Button value="20ft">20 ft Price</Radio.Button>
                    <Radio.Button value="40ft">40 ft Price</Radio.Button>
                  </Radio.Group>
                </Space>

                <Tag color="green" icon={<CheckOutlined />}>
                  Handsontable Formula Engine Active • Live Recalculations
                </Tag>
              </div>

              {/* Financial Parameters Quick-Tune Strip (Excel S2:S6) */}
              <div style={{ display: "flex", alignItems: "center", gap: 14, background: "#ffffff", padding: "8px 14px", border: "1px dashed #0284c7", borderRadius: 6, flexWrap: "wrap", fontSize: "0.82rem" }}>
                <span style={{ fontWeight: 800, color: "#0284c7", display: "flex", alignItems: "center", gap: 4 }}>
                  <span>📊 Financial Parameters (S2:Y6):</span>
                </span>
                
                {/* 1. Exchange Rate */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Text strong style={{ fontSize: "0.78rem", color: "#334155" }}>Exch. Rate (LKR):</Text>
                  <InputNumber 
                    size="small" 
                    value={financialParams.exchangeRate} 
                    min={1}
                    step={0.5}
                    style={{ width: 90 }} 
                    onChange={(val) => handleImmediateParamChange("exchangeRate", parseFloat(val) || 305)}
                    onBlur={() => handleParamCommit("exchangeRate", "Exchange Rate")}
                  />
                </div>

                {/* 2. Margin % */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Text strong style={{ fontSize: "0.78rem", color: "#334155" }}>Margin:</Text>
                  <InputNumber 
                    size="small" 
                    value={financialParams.margin !== undefined ? Number((financialParams.margin * 100).toFixed(1)) : 40} 
                    min={0}
                    max={100}
                    step={1}
                    formatter={v => `${v}%`}
                    parser={v => v.replace('%', '')}
                    style={{ width: 80 }} 
                    onChange={(val) => {
                      const parsed = parseFloat(val) || 0;
                      handleImmediateParamChange("margin", parsed / 100);
                    }}
                    onBlur={() => handleParamCommit("margin", "Margin %")}
                  />
                </div>

                {/* 3. CIF Freight Rate ($) */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Text strong style={{ fontSize: "0.78rem", color: "#334155" }}>CIF Freight ($):</Text>
                  <InputNumber 
                    size="small" 
                    value={financialParams.cifRate} 
                    min={0}
                    step={50}
                    formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={v => v.replace(/\$\s?|(,*)/g, '')}
                    style={{ width: 95 }} 
                    onChange={(val) => handleImmediateParamChange("cifRate", parseFloat(val) || 0)}
                    onBlur={() => handleParamCommit("cifRate", "CIF Rate")}
                  />
                </div>

                {/* 4. Export Expense (LKR) */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Text strong style={{ fontSize: "0.78rem", color: "#334155" }}>Export Exp (LKR):</Text>
                  <InputNumber 
                    size="small" 
                    value={financialParams.exportExpense} 
                    min={0}
                    step={5000}
                    formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                    parser={v => v.replace(/\$\s?|(,*)/g, '')}
                    style={{ width: 100 }} 
                    onChange={(val) => handleImmediateParamChange("exportExpense", parseFloat(val) || 0)}
                    onBlur={() => handleParamCommit("exportExpense", "Export Expense")}
                  />
                </div>

                {/* 5. VAT % */}
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <Text strong style={{ fontSize: "0.78rem", color: "#334155" }}>VAT:</Text>
                  <InputNumber 
                    size="small" 
                    value={financialParams.vat !== undefined ? Number((financialParams.vat * 100).toFixed(1)) : 20} 
                    min={0}
                    max={100}
                    step={1}
                    formatter={v => `${v}%`}
                    parser={v => v.replace('%', '')}
                    style={{ width: 75 }} 
                    onChange={(val) => {
                      const parsed = parseFloat(val) || 0;
                      handleImmediateParamChange("vat", parsed / 100);
                    }}
                    onBlur={() => handleParamCommit("vat", "VAT %")}
                  />
                </div>

                <span style={{ fontSize: "0.72rem", color: "#059669", fontWeight: 600, marginLeft: "auto" }}>
                  ● Real-time formula recalculation
                </span>
              </div>
            </div>

            {/* Excel Row 2 to 8 Header Section */}
            <div style={{ padding: "16px 20px", borderBottom: excelGridBorder }}>
              
              {/* Row 2: Merged Title Box (D2:T5) & Ref / Date Box (U2:V4) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", border: excelGridBorder, marginBottom: 16 }}>
                
                {/* D2:T5 Title Banner */}
                <div 
                  onClick={() => { setActiveCellAddress("D2"); setActiveCellValue("Price Quotation"); }}
                  style={{ 
                    padding: "24px 28px", 
                    display: "flex", 
                    alignItems: "center", 
                    background: "#ffffff", 
                    borderRight: excelGridBorder,
                    cursor: "pointer" 
                  }}
                >
                  <Title level={2} style={{ margin: 0, color: "#1e3a8a", fontWeight: 800, letterSpacing: "-0.02em" }}>
                    Price Quotation
                  </Title>
                </div>

                {/* U2:V4 Quotation Ref & Date Grid */}
                <div style={{ background: "#f8fafc" }}>
                  <div 
                    onClick={() => { setActiveCellAddress("U2"); setActiveCellValue(quotationNo); }}
                    style={{ display: "grid", gridTemplateColumns: "150px 1fr", borderBottom: excelGridBorder, padding: "8px 12px", alignItems: "center" }}
                  >
                    <Text strong style={{ fontSize: "0.85rem", color: "#334155" }}>Quotation ref number :</Text>
                    <Input 
                      value={quotationNo} 
                      onChange={(e) => setQuotationNo(e.target.value)}
                      style={{ fontWeight: 700, color: "#0284c7", borderRadius: 4, background: "#ffffff" }}
                    />
                  </div>
                  <div 
                    onClick={() => { setActiveCellAddress("U4"); setActiveCellValue(quotationDate); }}
                    style={{ display: "grid", gridTemplateColumns: "150px 1fr", padding: "8px 12px", alignItems: "center" }}
                  >
                    <Text strong style={{ fontSize: "0.85rem", color: "#334155" }}>Date :</Text>
                    <Input 
                      value={quotationDate} 
                      type="date"
                      onChange={(e) => setQuotationDate(e.target.value)}
                      style={{ borderRadius: 4, background: "#ffffff" }}
                    />
                  </div>
                </div>
              </div>

              {/* Row 6: Shipper & Buyer Grid (B6:I8 & J6:T8) */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", border: excelGridBorder, background: "#ffffff" }}>
                
                {/* Shipper Block (B6:I8) */}
                <div 
                  onClick={() => { setActiveCellAddress("B6"); setActiveCellValue("Shipper: Toyo Cushion Lanka"); }}
                  style={{ padding: "14px 18px", borderRight: excelGridBorder, background: "#fcfdfe" }}
                >
                  <Text strong style={{ color: "#1e3a8a", display: "block", marginBottom: 6, fontSize: "0.9rem" }}>Shipper :</Text>
                  <div style={{ fontSize: "0.85rem", color: "#1e293b", lineHeight: 1.5 }}>
                    <strong style={{ color: "#0f172a" }}>{shipper.shipperName || "Toyo Cushion Lanka"}</strong><br />
                    COMPANY NO : {shipper.companyNo || "PV 5492"}<br />
                    {shipper.address || "400 Deans Road Colombo 10 01000 Sri Lanka"}<br />
                    Tel: {shipper.phone || "94112232939-Fixed"}
                  </div>
                </div>

                {/* Buyer Block (J6:T8) */}
                <div 
                  onClick={() => { setActiveCellAddress("J6"); setActiveCellValue(buyerName); }}
                  style={{ padding: "14px 18px", background: "#ffffff" }}
                >
                  <Text strong style={{ color: "#1e3a8a", display: "block", marginBottom: 6, fontSize: "0.9rem" }}>Buyer :</Text>
                  <Input
                    value={buyerName}
                    onChange={(e) => setBuyerName(e.target.value)}
                    placeholder="Auto Pick the Buyer name from cost sheet, and have Edit option as well"
                    style={{ fontWeight: 700, fontSize: "0.95rem", color: "#0f172a", borderRadius: 4, marginBottom: 4 }}
                  />
                  <Text type="secondary" style={{ fontSize: "0.75rem", display: "block" }}>
                    Auto picked from cost sheet with full edit capability
                  </Text>
                </div>
              </div>

            </div>

            {/* Handsontable Template Grid */}
            <div className="hot-container" style={{ padding: 12, overflowX: "auto" }}>
              <HotTable
                ref={templateHotRef}
                data={templateHotData}
                columns={activeTab === "sheet1_bedding" ? beddingTemplateHotColumns : hortiTemplateHotColumns}
                nestedHeaders={activeTab === "sheet1_bedding" ? beddingNestedHeaders : hortiNestedHeaders}
                colHeaders={true}
                rowHeaders={false}
                height="auto"
                licenseKey="non-commercial-and-evaluation"
                afterChange={handleHotChange}
                afterSelection={handleCellSelection}
                manualColumnResize={true}
                stretchH="all"
              />
            </div>

            {/* Notes & Commercial Terms (Exact match of Excel rows 15 - 26) */}
            <div style={{ margin: "0 20px 20px", border: excelGridBorder, background: "#f8fafc", padding: "18px 22px" }}>
              <div 
                onClick={() => { setActiveCellAddress("B15"); setActiveCellValue("Note"); }}
                style={{ fontWeight: 800, fontSize: "1rem", color: "#0f172a", marginBottom: 14 }}
              >
                Note
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "180px 1fr", gap: "12px 18px", alignItems: "center" }}>
                
                {/* Row 17: Packing */}
                <Text strong style={{ color: "#334155" }}>Packing</Text>
                <Input 
                  value={packing} 
                  onChange={(e) => setPacking(e.target.value)} 
                  style={{ borderRadius: 4, background: "#ffffff" }} 
                />

                {/* Row 18: Price Term */}
                <Text strong style={{ color: "#334155" }}>Price term</Text>
                <div style={{ display: "flex", gap: 16, alignItems: "center", flexWrap: "wrap" }}>
                  <Radio.Group value={priceTerm} onChange={(e) => setPriceTerm(e.target.value)}>
                    <Radio value="FOB">FOB</Radio>
                    <Radio value="EX_WORKS">EX Works</Radio>
                    <Radio value="CIF">CIF</Radio>
                    <Radio value="FOB_SEPARATE_CIF">FOB with separate CIF</Radio>
                  </Radio.Group>
                  <Radio.Group value={containerSize} onChange={(e) => setContainerSize(e.target.value)}>
                    <Radio value="20ft">20 ft Container</Radio>
                    <Radio value="40ft">40 ft Container</Radio>
                  </Radio.Group>
                </div>

                {/* Row 19: Payment Terms */}
                <Text strong style={{ color: "#334155" }}>Payment terms</Text>
                <Input 
                  value={paymentTerms} 
                  onChange={(e) => setPaymentTerms(e.target.value)} 
                  style={{ borderRadius: 4, background: "#ffffff" }} 
                />

                {/* Row 20: Validity */}
                <Text strong style={{ color: "#334155" }}>Validity</Text>
                <Input 
                  value={validity} 
                  onChange={(e) => setValidity(e.target.value)} 
                  style={{ borderRadius: 4, background: "#ffffff" }} 
                />

                {/* Row 21: Utilization Lead Time */}
                <Text strong style={{ color: "#334155" }}>Utilization Lead time</Text>
                <Input 
                  value={leadTime} 
                  onChange={(e) => setLeadTime(e.target.value)} 
                  style={{ borderRadius: 4, background: "#ffffff" }} 
                />
              </div>

              {/* Row 22-26: Shipper & Sales Officer Signature Grid */}
              <div style={{ marginTop: 22, paddingTop: 16, borderTop: excelGridBorder, display: "grid", gridTemplateColumns: "1.1fr 1fr", gap: 20, alignItems: "flex-start" }}>
                
                {/* Left: Shipper Details */}
                <div style={{ background: "#ffffff", padding: "12px 16px", border: excelGridBorder, borderRadius: 6 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                    <Text strong style={{ color: "#1e3a8a", fontSize: "0.88rem" }}>🏢 Shipper / Manufacturing Entity:</Text>
                    <Tag color="blue" style={{ fontSize: "0.72rem", margin: 0 }}>Official Exporter</Tag>
                  </div>
                  <div style={{ fontSize: "0.84rem", color: "#334155", lineHeight: 1.6 }}>
                    <strong style={{ color: "#0f172a", fontSize: "0.9rem" }}>{shipper.shipperName || "Toyo Cushion Lanka"}</strong><br />
                    COMPANY NO : {shipper.companyNo || "PV 5492"}<br />
                    {shipper.address || "400 Deans Road Colombo 10 01000 Sri Lanka"}<br />
                    Tel: {shipper.phone || "94112232939-Fixed"}
                  </div>
                </div>

                {/* Right: Sales Officer Profile & Signature (Auto-populated & Editable) */}
                <div style={{ background: "#ffffff", padding: "12px 16px", border: "1px solid #93c5fd", borderRadius: 6, boxShadow: "0 1px 4px rgba(2, 132, 199, 0.08)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10, flexWrap: "wrap", gap: 6 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <SafetyCertificateOutlined style={{ color: "#0284c7", fontSize: 16 }} />
                      <Text strong style={{ color: "#0f172a", fontSize: "0.88rem" }}>
                        Sales Officer & Authorized Signature
                      </Text>
                    </div>
                    <Tooltip title="Reset details to your logged-in profile">
                      <Button 
                        size="small" 
                        icon={<ReloadOutlined />} 
                        onClick={handleResetToMyProfile}
                        style={{ fontSize: "0.75rem", borderRadius: 4, color: "#0284c7", borderColor: "#bae6fd" }}
                      >
                        Reset to My Profile
                      </Button>
                    </Tooltip>
                  </div>

                  {/* Digital Signature / Signature Stamp Display */}
                  <div style={{ background: "#f8fafc", padding: "8px 12px", border: "1px dashed #cbd5e1", borderRadius: 6, marginBottom: 10, textAlign: "center", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                    {shipper.signatureImage ? (
                      <div style={{ display: "flex", alignItems: "center", gap: 12, justifyContent: "center" }}>
                        <img 
                          src={shipper.signatureImage} 
                          alt="Digital Signature" 
                          style={{ maxHeight: 42, maxWidth: 160, objectFit: "contain", border: "1px solid #e2e8f0", background: "#ffffff", padding: 2, borderRadius: 4 }} 
                        />
                        <Button 
                          danger 
                          size="small" 
                          icon={<DeleteOutlined />} 
                          onClick={() => handleSignatoryFieldChange("signatureImage", "")}
                          style={{ borderRadius: 4, fontSize: "0.72rem" }}
                        >
                          Remove Stamp
                        </Button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "center" }}>
                        <span style={{ fontSize: "1.1rem", letterSpacing: "2px", color: "#94a3b8" }}>………………………….</span>
                        <Upload beforeUpload={handleSignatureUpload} showUploadList={false} accept="image/*">
                          <Button size="small" icon={<UploadOutlined />} style={{ borderRadius: 4, fontSize: "0.72rem" }}>
                            Upload Stamp
                          </Button>
                        </Upload>
                      </div>
                    )}
                  </div>

                  {/* Editable Officer Details */}
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 10px" }}>
                    <div>
                      <Text style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginBottom: 2 }}>Officer Name:</Text>
                      <Input 
                        size="small"
                        prefix={<UserOutlined style={{ color: "#94a3b8" }} />}
                        value={shipper.signatoryName || ""}
                        placeholder="Sales Officer Name"
                        onChange={(e) => handleSignatoryFieldChange("signatoryName", e.target.value)}
                        style={{ fontWeight: 700, borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <Text style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginBottom: 2 }}>Designation / Role:</Text>
                      <Input 
                        size="small"
                        value={shipper.signatoryRole || ""}
                        placeholder="Designation"
                        onChange={(e) => handleSignatoryFieldChange("signatoryRole", e.target.value)}
                        style={{ borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <Text style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginBottom: 2 }}>Officer Email:</Text>
                      <Input 
                        size="small"
                        value={shipper.signatoryEmail || ""}
                        placeholder="officer@hayleysfibre.com"
                        onChange={(e) => handleSignatoryFieldChange("signatoryEmail", e.target.value)}
                        style={{ borderRadius: 4 }}
                      />
                    </div>
                    <div>
                      <Text style={{ fontSize: "0.72rem", color: "#64748b", display: "block", marginBottom: 2 }}>Direct Contact / Phone:</Text>
                      <Input 
                        size="small"
                        value={shipper.signatoryPhone || shipper.phone || ""}
                        placeholder="+94..."
                        onChange={(e) => handleSignatoryFieldChange("signatoryPhone", e.target.value)}
                        style={{ borderRadius: 4 }}
                      />
                    </div>
                  </div>

                </div>

              </div>
            </div>

          </div>
        )}

        {/* ========================================================================= */}
        {/* SHEET 2 & SHEET 4: HANDSONTABLE DATA ENTRY & BACKEND ENGINE                */}
        {/* ========================================================================= */}
        {(activeTab === "sheet2_bedding" || activeTab === "sheet4_horti") && (
          <div style={{ background: "#ffffff", border: "1px solid #cbd5e1", borderRadius: "0 4px 4px 4px", boxShadow: "0 2px 8px rgba(0,0,0,0.06)" }}>
            
            {/* Row 1 Header Banner */}
            <div 
              onClick={() => { setActiveCellAddress("A1"); setActiveCellValue("HAYFIBRE OPERATIONS - PRODUCT COSTING SHEET"); }}
              style={{ background: excelDarkHeader, color: "#ffffff", padding: "12px 20px", textAlign: "center", fontWeight: 800, fontSize: "1rem", letterSpacing: "0.05em" }}
            >
              HAYFIBRE OPERATIONS - PRODUCT COSTING SHEET
            </div>

            {/* Top Parameters & Metadata Section (Rows 2 - 8) */}
            <div style={{ padding: 16, borderBottom: excelGridBorder, background: "#ffffff" }}>
              <Row gutter={[20, 16]}>
                
                {/* Left Column: Request Details Metadata (Rows 3, 4, 7, 8) */}
                <Col xs={24} lg={12}>
                  <div style={{ border: excelGridBorder, background: "#f8fafc" }}>
                    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 140px 1fr", borderBottom: excelGridBorder, padding: "6px 10px", alignItems: "center" }}>
                      <Text strong style={{ fontSize: "0.8rem", color: "#334155" }}>Cost Request No:</Text>
                      <span style={{ fontWeight: 700, color: "#0284c7" }}>{request?.costRequestNo || "-"}</span>
                      <Text strong style={{ fontSize: "0.8rem", color: "#334155" }}>Request Date:</Text>
                      <span>{request?.requestDate ? new Date(request.requestDate).toLocaleDateString() : "-"}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 140px 1fr", borderBottom: excelGridBorder, padding: "6px 10px", alignItems: "center" }}>
                      <Text strong style={{ fontSize: "0.8rem", color: "#334155" }}>Customer Name:</Text>
                      <span style={{ fontWeight: 700 }}>{buyerName || request?.customerName || "-"}</span>
                      <Text strong style={{ fontSize: "0.8rem", color: "#334155" }}>Completion Date:</Text>
                      <span>{request?.completionDate ? new Date(request.completionDate).toLocaleDateString() : "-"}</span>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 140px 1fr", borderBottom: excelGridBorder, padding: "6px 10px", alignItems: "center" }}>
                      <Text strong style={{ fontSize: "0.8rem", color: "#334155" }}>Product Category:</Text>
                      <Tag color="geekblue">{category.toUpperCase()}</Tag>
                      <Text strong style={{ fontSize: "0.8rem", color: "#334155" }}>Status:</Text>
                      <Tag color="success">{request?.status || "Costing Completed"}</Tag>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "150px 1fr 140px 1fr", padding: "6px 10px", alignItems: "center" }}>
                      <Text strong style={{ fontSize: "0.8rem", color: "#334155" }}>Marketing Officer:</Text>
                      <span>
                        <strong style={{ color: "#0f172a" }}>{shipper.signatoryName || request?.marketingOfficer?.name || "-"}</strong>
                        {shipper.signatoryEmail && <span style={{ fontSize: "0.75rem", color: "#64748b", marginLeft: 4 }}>({shipper.signatoryEmail})</span>}
                      </span>
                      <Text strong style={{ fontSize: "0.8rem", color: "#334155" }}>Finance Officer:</Text>
                      <span>{request?.financeOfficer?.name || "-"}</span>
                    </div>
                  </div>
                </Col>

                {/* Right Column: Exact Parameters & Option Checkboxes (Columns R - Y, Rows 2 - 6) */}
                <Col xs={24} lg={12}>
                  <div style={{ border: excelGridBorder, background: "#ffffff" }}>
                    
                    {/* Row 2: Export expense | 20 ft price | FOB */}
                    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 100px 1fr", borderBottom: excelGridBorder, padding: "4px 8px", alignItems: "center" }}>
                      <Text strong style={{ fontSize: "0.8rem" }}>Export expence</Text>
                      <InputNumber
                        value={financialParams.exportExpense}
                        min={0}
                        step={5000}
                        formatter={v => `${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={v => v.replace(/\D/g, '')}
                        style={{ width: "95%" }}
                        onChange={(val) => handleImmediateParamChange("exportExpense", parseFloat(val) || 0)}
                        onBlur={() => handleParamCommit("exportExpense", "Export Expense")}
                      />
                      <Text strong style={{ fontSize: "0.8rem" }}>20 ft price</Text>
                      <Radio checked={containerSize === "20ft"} onChange={() => setContainerSize("20ft")}>
                        Active
                      </Radio>
                    </div>

                    {/* Row 3: Exchange rate | 40ft price | EX works */}
                    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 100px 1fr", borderBottom: excelGridBorder, padding: "4px 8px", alignItems: "center" }}>
                      <Text strong style={{ fontSize: "0.8rem" }}>Exhange rate</Text>
                      <InputNumber
                        value={financialParams.exchangeRate}
                        min={1}
                        step={0.5}
                        style={{ width: "95%" }}
                        onChange={(val) => handleImmediateParamChange("exchangeRate", parseFloat(val) || 305)}
                        onBlur={() => handleParamCommit("exchangeRate", "Exchange Rate")}
                      />
                      <Text strong style={{ fontSize: "0.8rem" }}>40ft price </Text>
                      <Radio checked={containerSize === "40ft"} onChange={() => setContainerSize("40ft")}>
                        Active
                      </Radio>
                    </div>

                    {/* Row 4: Margin | CIF */}
                    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 100px 1fr", borderBottom: excelGridBorder, padding: "4px 8px", alignItems: "center" }}>
                      <Text strong style={{ fontSize: "0.8rem" }}>Margin</Text>
                      <InputNumber
                        value={financialParams.margin !== undefined ? Number((financialParams.margin * 100).toFixed(1)) : 40}
                        min={0}
                        max={100}
                        step={1}
                        formatter={v => `${v}%`}
                        parser={v => v.replace('%', '')}
                        style={{ width: "95%" }}
                        onChange={(val) => {
                          const parsed = parseFloat(val) || 0;
                          handleImmediateParamChange("margin", parsed / 100);
                        }}
                        onBlur={() => handleParamCommit("margin", "Margin %")}
                      />
                      <Text strong style={{ fontSize: "0.8rem" }}>Price Term</Text>
                      <Radio.Group value={priceTerm} onChange={(e) => setPriceTerm(e.target.value)} size="small">
                        <Radio value="FOB">FOB</Radio>
                        <Radio value="EX_WORKS">EXW</Radio>
                      </Radio.Group>
                    </div>

                    {/* Row 5: CIF rate | FOB with separate CIF */}
                    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr 100px 1fr", borderBottom: excelGridBorder, padding: "4px 8px", alignItems: "center" }}>
                      <Text strong style={{ fontSize: "0.8rem" }}>CIF rate</Text>
                      <InputNumber
                        value={financialParams.cifRate}
                        min={0}
                        step={50}
                        formatter={v => `$ ${v}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')}
                        parser={v => v.replace(/\$\s?|(,*)/g, '')}
                        style={{ width: "95%" }}
                        onChange={(val) => handleImmediateParamChange("cifRate", parseFloat(val) || 0)}
                        onBlur={() => handleParamCommit("cifRate", "CIF Rate")}
                      />
                      <Text strong style={{ fontSize: "0.8rem" }}>Terms (cont)</Text>
                      <Radio.Group value={priceTerm} onChange={(e) => setPriceTerm(e.target.value)} size="small">
                        <Radio value="CIF">CIF</Radio>
                        <Radio value="FOB_SEPARATE_CIF">FOB+CIF</Radio>
                      </Radio.Group>
                    </div>

                    {/* Row 6: Vat */}
                    <div style={{ display: "grid", gridTemplateColumns: "130px 1fr", padding: "4px 8px", alignItems: "center" }}>
                      <Text strong style={{ fontSize: "0.8rem" }}>Vat</Text>
                      <InputNumber
                        value={financialParams.vat !== undefined ? Number((financialParams.vat * 100).toFixed(1)) : 20}
                        min={0}
                        max={100}
                        step={1}
                        formatter={v => `${v}%`}
                        parser={v => v.replace('%', '')}
                        style={{ width: "45%" }}
                        onChange={(val) => {
                          const parsed = parseFloat(val) || 0;
                          handleImmediateParamChange("vat", parsed / 100);
                        }}
                        onBlur={() => handleParamCommit("vat", "VAT %")}
                      />
                    </div>
                  </div>
                </Col>
              </Row>
            </div>

            {/* Row 9 Annotations Header Banner */}
            <div style={{ background: "#e0f2fe", padding: "6px 12px", borderBottom: excelGridBorder, fontSize: "0.75rem", color: "#0369a1", fontWeight: 600, display: "flex", justifyContent: "space-between" }}>
              <span>Handsontable Calculation Engine • Edits in this table automatically update the Quotation Template</span>
              <Tag color="green">Formula Engine Active</Tag>
            </div>

            {/* Handsontable Calculation Grid */}
            <div className="hot-container" style={{ padding: 12, overflowX: "auto" }}>
              <HotTable
                ref={dataEntryHotRef}
                data={dataEntryHotData}
                columns={isBedding ? beddingDataEntryHotColumns : hortiDataEntryHotColumns}
                colHeaders={true}
                rowHeaders={false}
                height="auto"
                licenseKey="non-commercial-and-evaluation"
                afterChange={handleHotChange}
                afterSelection={handleCellSelection}
                manualColumnResize={true}
                stretchH="all"
              />
            </div>

            {/* Bottom Formula Situations Guide (Exact match of Excel rows 12-17) */}
            <div style={{ padding: 16, background: "#f8fafc", borderTop: excelGridBorder }}>
              <Text strong style={{ color: "#0f172a", display: "block", marginBottom: 8 }}>
                Special Packing & Loading Calculation Modes (as embedded in Excel):
              </Text>
              
              {activeTab === "sheet2_bedding" ? (
                <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 12, fontSize: "0.8rem" }}>
                  <div style={{ background: "#ffffff", padding: "10px 14px", border: excelGridBorder, borderRadius: 4 }}>
                    <strong style={{ color: "#0284c7" }}>In a situation of bundles with pallet loading:</strong><br />
                    • Bundles per 20ft: No required<br />
                    • Qty per 40ft = Auto cal =(L x J x H) • Qty per 20ft = Auto cal =(M x J x H)<br />
                    • Pricing equations: FOB, CIF, EXW apply uniformly
                  </div>
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, fontSize: "0.75rem" }}>
                  <div style={{ background: "#ffffff", padding: "8px 12px", border: excelGridBorder, borderRadius: 4 }}>
                    <strong style={{ color: "#0284c7" }}>1. In a situation of no cartons & bundle floor loaded:</strong><br />
                    Pallets 40ft / 20ft: Manual entry<br />
                    Cartons/Bundles 20ft = Auto cal (O x F) • Cartons/Bundles 40ft = Auto cal (N x F) • Qty = SAME
                  </div>
                  <div style={{ background: "#ffffff", padding: "8px 12px", border: excelGridBorder, borderRadius: 4 }}>
                    <strong style={{ color: "#059669" }}>2. In a situation of cartons/bundles with pallet loading:</strong><br />
                    Pallets: No required<br />
                    Cartons/Bundles 20ft = Auto cal =(L x I x F) • Cartons/Bundles 40ft = Auto cal =(M x I x F) • Qty = SAME
                  </div>
                  <div style={{ background: "#ffffff", padding: "8px 12px", border: excelGridBorder, borderRadius: 4 }}>
                    <strong style={{ color: "#8b5cf6" }}>3. In a situation of Roll form loading:</strong><br />
                    Pallets: No required<br />
                    Cartons/Bundles 20ft / 40ft = Manual entry • Qty = SAME
                  </div>
                </div>
              )}
            </div>

          </div>
        )}

      </div>

      {/* Image Preview Modal */}
      <Modal
        open={!!previewImage}
        footer={null}
        onCancel={() => setPreviewImage(null)}
        centered
        width={450}
      >
        {previewImage && (
          <div style={{ textAlign: "center", padding: "10px 0" }}>
            <img src={previewImage} alt="Product Preview" style={{ maxWidth: "100%", maxHeight: "70vh", objectFit: "contain", borderRadius: 8 }} />
          </div>
        )}
      </Modal>

      {/* Saved Details Catalog Modal */}
      <SavedDetailsModal
        visible={savedModalVisible}
        onClose={() => setSavedModalVisible(false)}
        onSelect={handlePresetSelect}
        category={category}
      />

      {/* Parameters Change Audit Log Modal */}
      <ParametersLogModal
        visible={logsModalVisible}
        onClose={() => setLogsModalVisible(false)}
        costRequestId={id}
      />
    </div>
  );
}
