import React, { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import * as costingService from "../../services/firebase/costingService";
import ExcelJS from "exceljs";
import * as notificationService from "../../services/firebase/notificationService";
import { Row, Col, Card, Typography, Button, Tag, Space, Alert, Spin, Descriptions, Modal, Upload } from "antd";
import {
  LeftOutlined,
  PlayCircleOutlined,
  SaveOutlined,
  CheckCircleOutlined,
  DownloadOutlined,
  RollbackOutlined,
  EditOutlined,
  CloseCircleOutlined,
  InboxOutlined,
  FileTextOutlined,
  PlusOutlined,
  DeleteOutlined,
  FileDoneOutlined,
  CalculatorOutlined
} from "@ant-design/icons";

import * as costingPacking from "../../utils/costingPackingConfig";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";

registerAllModules();

const { Title, Text } = Typography;

export default function RequestDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { currentUser } = useAuth();

  const [request, setRequest] = useState(null);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // Editing states (for Finance entry or Marketing/Admin correction)
  const [costingDraft, setCostingDraft] = useState({});
  const [specsDraft, setSpecsDraft] = useState({});
  const [isCorrectingDetails, setIsCorrectingDetails] = useState(false);

  // Table refs and data
  const hotTableRef = useRef(null);
  const [tableData, setTableData] = useState([]);

  useEffect(() => {
    async function loadRequest() {
      try {
        setLoading(true);
        const data = await costingService.getCostingRequestById(id);
        setRequest(data);
        setCostingDraft(data.costing || {});
        setSpecsDraft(data.specs || {});
        
        const cats = await costingService.getProductCategories();
        setCategories(cats);
      } catch (err) {
        console.error("Error loading request:", err);
        setError("Failed to load costing request details.");
      } finally {
        setLoading(false);
      }
    }
    loadRequest();
  }, [id]);

  const activeCategory = (categories || []).find(c => c?.id === request?.productUnit);
  let requestFields = [];
  if (request?.categoryFieldsJson) {
    try {
      requestFields = JSON.parse(request.categoryFieldsJson);
    } catch (e) {
      console.error("Failed to parse categoryFieldsJson:", e);
      requestFields = request?.categoryFields || activeCategory?.fields || [];
    }
  } else {
    requestFields = request?.categoryFields || activeCategory?.fields || [];
  }

  // 1. Ensure Marketing Fields include packingConfiguration
  let rawMarketingFields = requestFields.filter(f => f.owner === "marketing");
  const packingOptions = costingPacking.getPackingOptionsForCategory(request?.productUnit || activeCategory?.name);
  if (!rawMarketingFields.some(f => f.key === "packingConfiguration")) {
    const insertIdx = rawMarketingFields.length > 0 ? 1 : 0;
    rawMarketingFields.splice(insertIdx, 0, {
      key: "packingConfiguration",
      label: "Packing Configuration",
      type: "select",
      options: packingOptions,
      required: true,
      owner: "marketing"
    });
  } else {
    rawMarketingFields = rawMarketingFields.map(f => {
      if (f.key === "packingConfiguration") {
        return { ...f, type: "select", options: packingOptions, required: true };
      }
      return f;
    });
  }

  // Ensure NC/RC Ratio, Density, and Latex Ratio are select dropdowns with standard presets
  rawMarketingFields = rawMarketingFields.map(f => {
    if (f.key === "ncRcRatio") {
      return {
        ...f,
        type: "select",
        options: f.options && f.options.length > 0 ? f.options : ["80:20", "70:30", "100:0", "60:40", "50:50", "90:10"],
        required: true
      };
    }
    if (f.key === "density") {
      return {
        ...f,
        type: "select",
        options: f.options && f.options.length > 0 ? f.options : ["80 kg/m3", "65 kg/m3", "70 kg/m3", "90 kg/m3", "100 kg/m3", "120 kg/m3"],
        required: true
      };
    }
    if (f.key === "latexRatio") {
      return {
        ...f,
        type: "select",
        options: f.options && f.options.length > 0 ? f.options : ["80:20", "70:30", "100:0", "60:40", "50:50"],
        required: true
      };
    }
    return f;
  });

  if (!rawMarketingFields.some(f => f.key === "marketingRemarks" || f.key === "remarks")) {
    rawMarketingFields = [
      ...rawMarketingFields,
      { key: "marketingRemarks", label: "Marketing Remarks", type: "text", required: false, owner: "marketing" }
    ];
  }
  const marketingFields = rawMarketingFields;

  // 2. Ensure Finance Fields have complete standardized packing & dimension fields
  let rawFinanceFields = requestFields.filter(f => f.owner === "finance");
  const isBedding = (request?.productUnit || "").toLowerCase().includes("bedding") || (activeCategory?.name || "").toLowerCase().includes("bedding");
  
  const standardFinanceKeys = [
    { key: "packing", label: "Packing (Pcs / Ctn / Bdl / Roll)", type: "number", required: false, owner: "finance" },
    { key: "cartonSize", label: isBedding ? "Bundle Size (CM)" : "Carton / Bundle Size (CM)", type: "text", required: false, owner: "finance" },
    { key: "palletSize", label: "Pallet Size (CM)", type: "text", required: false, owner: "finance" },
    { key: "cartonsPerPallet", label: isBedding ? "Bundles per Pallet" : "Cartons / Bundles per Pallet", type: "number", required: false, owner: "finance" },
    ...(!isBedding ? [
      { key: "rollDiameter", label: "Roll Diameter (CM)", type: "text", required: false, owner: "finance" },
      { key: "rollLength", label: "Roll Length (CM / M)", type: "text", required: false, owner: "finance" },
    ] : []),
    { key: "unitCost", label: "Unit Cost ($)", type: "number", required: true, owner: "finance" }
  ];

  // Merge so we preserve any custom fields from Firestore while ensuring standard keys exist
  const existingFinanceKeys = new Set(rawFinanceFields.map(f => f.key));
  standardFinanceKeys.forEach(sf => {
    if (!existingFinanceKeys.has(sf.key)) {
      rawFinanceFields.push(sf);
    }
  });
  // Sort finance fields order
  const orderMap = { packing: 1, cartonSize: 2, palletSize: 3, cartonsPerPallet: 4, rollDiameter: 5, rollLength: 6, unitCost: 7 };
  rawFinanceFields.sort((a, b) => (orderMap[a.key] || 99) - (orderMap[b.key] || 99));

  const financeFields = rawFinanceFields;

  const isFinanceOfficer = currentUser.costingRoles?.includes("costing_finance") || currentUser.costingRoles?.includes("admin") || currentUser.roles?.includes("admin");
  const isMarketingOfficer = currentUser.costingRoles?.includes("costing_marketing") || currentUser.costingRoles?.includes("admin") || currentUser.roles?.includes("admin") || request?.marketingOfficer?.uid === currentUser.uid || request?.createdByUid === currentUser.uid;
  const isAdmin = currentUser.roles?.includes("admin") || currentUser.costingRoles?.includes("admin");
  const isCompleted = request?.status === "Costing Completed" || request?.status === "Sent to Marketing";
  const canReopen = (isAdmin || isMarketingOfficer) && isCompleted;
  
  // Marketing can correct request until Finance receives it (status is Submitted)
  const canMarketingCorrect = isMarketingOfficer && request?.status === "Submitted";
  const canFinanceOrAdminCorrect = (isFinanceOfficer || isAdmin) && !isCompleted;
  const showCorrectDetails = (canMarketingCorrect || canFinanceOrAdminCorrect) && !isCorrectingDetails;

  const isCostingActive = ((isFinanceOfficer && (request?.status === "Costing in Progress" || request?.status === "Overdue")) || isCorrectingDetails) && !request?.specs?.excelFile;

  // Initialize Handsontable Grid data when request loads
  useEffect(() => {
    if (request && categories.length > 0) {
      let itemsList = [];
      if (Array.isArray(request.specs?.items)) {
        itemsList = request.specs.items;
      } else if (request.specs?.items && typeof request.specs.items === "object") {
        itemsList = Object.values(request.specs.items);
      } else if (request.specs && typeof request.specs === "object") {
        itemsList = [request.specs];
      } else {
        itemsList = [{}];
      }

      const initialRows = itemsList.map((item, idx) => {
        const rowObj = {
          itemNo: idx + 1
        };
        
        // Specs values
        marketingFields.forEach(f => {
          rowObj[`spec_${f.key}`] = item && item[f.key] !== undefined ? item[f.key] : "";
        });

        const packingConfig = item?.packingConfiguration || rowObj.spec_packingConfiguration || costingPacking.getDefaultPackingOption(request.productUnit);
        if (!rowObj.spec_packingConfiguration) {
          rowObj.spec_packingConfiguration = packingConfig;
        }
        
        // Costing values
        let itemCosting = request.specs?.items 
          ? (costingDraft.items?.[idx] || costingDraft.items?.[String(idx)] || request.costing?.items?.[idx] || request.costing?.items?.[String(idx)] || {})
          : (costingDraft || request.costing || {});
        
        // Apply auto-zero to non-applicable fields
        itemCosting = costingPacking.applyAutoZeroToCosting(itemCosting, packingConfig);

        financeFields.forEach(f => {
          rowObj[`cost_${f.key}`] = itemCosting && itemCosting[f.key] !== undefined ? itemCosting[f.key] : "";
        });
        
        return rowObj;
      });
      setTableData(initialRows);
    }
  }, [request, categories, isCorrectingDetails]);

  const handleDetailsTableChange = (changes, source) => {
    if (source === "loadData" || !changes) return;
    
    // Check if finance entered an irrelevant/non-numeric carton or bundle size
    changes.forEach(([row, prop, oldVal, newVal]) => {
      if (prop === "cost_cartonSize" && newVal !== oldVal && newVal !== "" && newVal !== "0" && newVal !== undefined && newVal !== null) {
        if (!costingPacking.isValidDimensionString(newVal)) {
          Modal.warning({
            title: "Numerical Dimension Required",
            centered: true,
            content: (
              <div style={{ marginTop: 8 }}>
                <p style={{ color: "#0f172a", fontWeight: 600, marginBottom: 8 }}>
                  The entered Carton / Bundle size <code>"{newVal}"</code> is not a valid numerical dimension.
                </p>
                <p style={{ color: "#64748b", fontSize: "0.85rem", margin: 0 }}>
                  Please enter numerical dimensions in centimeters (e.g. <strong>57X51X58 CM</strong>, <strong>60x60x50</strong>, or <strong>L x W x H</strong>). Irrelevant text or words without dimensions cannot be accepted.
                </p>
              </div>
            ),
            okText: "Understand"
          });
        }
      }
    });

    const hot = hotTableRef.current?.hotInstance;
    if (!hot) return;
    
    const gridData = hot.getSourceData();
    
    if (request.specs?.items) {
      const updatedCostingItems = {};
      const updatedSpecsItems = [];
      
      gridData.forEach((row, idx) => {
        const specObj = {};
        marketingFields.forEach(f => {
          specObj[f.key] = row[`spec_${f.key}`];
        });
        updatedSpecsItems.push(specObj);
        
        const packingConfig = specObj.packingConfiguration || row.spec_packingConfiguration || costingPacking.getDefaultPackingOption(request.productUnit);
        const rules = costingPacking.getFinanceFieldRules(packingConfig);

        const costObj = {};
        financeFields.forEach(f => {
          let val = row[`cost_${f.key}`];
          if (rules.nonApplicable.includes(f.key)) {
            val = f.type === "number" ? 0 : "0";
            row[`cost_${f.key}`] = val;
          } else if (f.type === "number" && val !== "" && val !== undefined && val !== null) {
            val = Number(val);
          }
          costObj[f.key] = val !== undefined ? val : "";
        });
        updatedCostingItems[idx] = costObj;
      });
      
      setSpecsDraft({ items: updatedSpecsItems });
      setCostingDraft(prev => ({
        ...prev,
        items: updatedCostingItems
      }));
    } else {
      const row = gridData[0] || {};
      
      const specObj = {};
      marketingFields.forEach(f => {
        specObj[f.key] = row[`spec_${f.key}`];
      });
      setSpecsDraft(specObj);
      
      const packingConfig = specObj.packingConfiguration || row.spec_packingConfiguration || costingPacking.getDefaultPackingOption(request.productUnit);
      const rules = costingPacking.getFinanceFieldRules(packingConfig);

      const costObj = {};
      financeFields.forEach(f => {
        let val = row[`cost_${f.key}`];
        if (rules.nonApplicable.includes(f.key)) {
          val = f.type === "number" ? 0 : "0";
          row[`cost_${f.key}`] = val;
        } else if (f.type === "number" && val !== "" && val !== undefined && val !== null) {
          val = Number(val);
        }
        costObj[f.key] = val !== undefined ? val : "";
      });
      setCostingDraft(prev => ({
        ...prev,
        ...costObj
      }));
    }
  };

  // Excel handlers
  const handleFinanceExcelUpload = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setCostingDraft(prev => ({
        ...prev,
        excelFile: {
          name: file.name,
          content: e.target.result // Base64 Data URL
        }
      }));
      setError("");
    };
    reader.readAsDataURL(file);
    return false; // Prevent auto upload
  };

  const handleDownloadExcel = (fileObj) => {
    if (!fileObj || !fileObj.content) return;
    const link = document.createElement("a");
    link.href = fileObj.content;
    link.download = fileObj.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Workflow Action Handlers
  const handleReceive = async () => {
    try {
      setError("");
      setSaving(true);
      const updated = await costingService.receiveCostingRequest(id, currentUser);
      setRequest(updated);
      setSuccessMsg("Request received successfully by Finance.");
    } catch (err) {
      setError(err.message || "Failed to receive request.");
    } finally {
      setSaving(false);
    }
  };

  const handleStartCosting = async () => {
    try {
      setError("");
      setSaving(true);
      const updated = await costingService.startCostingRequest(id);
      setRequest(updated);
      setSuccessMsg("Costing phase started.");
    } catch (err) {
      setError(err.message || "Failed to start costing.");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveDraft = async () => {
    try {
      setError("");
      setSaving(true);
      const updated = await costingService.saveCostingDataDraft(id, costingDraft);
      setRequest(updated);
      setSuccessMsg("Costing draft saved successfully.");
    } catch (err) {
      setError(err.message || "Failed to save draft.");
    } finally {
      setSaving(false);
    }
  };

  const handleCompleteCosting = async () => {
    setError("");

    if (request.specs?.excelFile) {
      if (!costingDraft.excelFile) {
        const errorMsg = "Please upload the completed costing Excel file before completing costing.";
        setError(errorMsg);
        Modal.error({
          title: "Costing Incomplete",
          content: errorMsg,
          okText: "OK"
        });
        return;
      }
    } else {
      const itemsCount = request.specs?.items ? request.specs.items.length : 1;
      const costingItems = request.specs?.items ? (costingDraft.items || {}) : costingDraft;
      const specsItems = request.specs?.items || [request.specs || {}];
      const finalizedCostingItems = {};
      const errors = [];

      for (let i = 0; i < itemsCount; i++) {
        const itemCosting = request.specs?.items ? (costingItems[i] || costingItems[String(i)]) : costingItems;
        const itemSpec = specsItems[i] || {};
        const packingConfig = itemSpec.packingConfiguration || tableData[i]?.spec_packingConfiguration || costingPacking.getDefaultPackingOption(request.productUnit);

        if (!itemCosting) {
          errors.push(`Item #${i + 1}: Costing parameters have not been entered.`);
          continue;
        }

        // Validate mandatory fields for the selected packing configuration
        const validation = costingPacking.validateFinanceCostingItem(itemCosting, packingConfig, i);
        if (!validation.valid) {
          errors.push(validation.error);
        } else {
          // Ensure non-applicable fields are auto-zeroed
          finalizedCostingItems[i] = costingPacking.applyAutoZeroToCosting(itemCosting, packingConfig);
        }
      }

      if (errors.length > 0) {
        setError(errors.join(" | "));
        Modal.error({
          title: "Cannot Complete Costing",
          width: 540,
          centered: true,
          content: (
            <div style={{ marginTop: 12 }}>
              <p style={{ marginBottom: 12, color: "#334155", fontSize: "0.92rem", fontWeight: 500 }}>
                Costing submission cannot proceed because mandatory fields are missing or invalid for the selected packing configurations:
              </p>
              <div 
                style={{ 
                  background: "#fef2f2", 
                  border: "1px solid #fecaca", 
                  borderRadius: 10, 
                  padding: "12px 16px",
                  maxHeight: 240,
                  overflowY: "auto"
                }}
              >
                <ul style={{ margin: 0, paddingLeft: 18, color: "#b91c1c", fontSize: "0.86rem", lineHeight: 1.6 }}>
                  {errors.map((err, idx) => (
                    <li key={idx} style={{ marginBottom: 4 }}>
                      <strong>{err}</strong>
                    </li>
                  ))}
                </ul>
              </div>
              <p style={{ marginTop: 12, marginBottom: 0, fontSize: "0.82rem", color: "#64748b" }}>
                💡 Tip: Review the highlighted columns in the grid for each item and ensure required values (e.g. Dimensions, Pallet size, Units per pallet, Unit cost) are provided.
              </p>
            </div>
          ),
          okText: "Got It",
          okButtonProps: {
            style: { borderRadius: 6, fontWeight: 700, background: "#ef4444", borderColor: "#ef4444" }
          }
        });
        return;
      }

      if (request.specs?.items) {
        costingDraft.items = finalizedCostingItems;
      } else {
        Object.assign(costingDraft, finalizedCostingItems[0] || {});
      }
    }

    try {
      setSaving(true);
      const updated = await costingService.completeCostingRequest(id, costingDraft);
      setRequest(updated);
      setSuccessMsg("Costing successfully completed and marked ready for Marketing.");
    } catch (err) {
      const errMsg = err.message || "Failed to complete costing.";
      setError(errMsg);
      Modal.error({
        title: "Submission Error",
        content: errMsg,
        okText: "Close"
      });
    } finally {
      setSaving(false);
    }
  };

  const handleReopen = () => {
    Modal.confirm({
      title: "Reopen Costing Request",
      content: `Are you sure you want to reopen Request #${request?.costRequestNo}? It will return to "Costing in Progress" for Finance to revise.`,
      okText: "Yes, Reopen",
      okType: "danger",
      cancelText: "Cancel",
      async onOk() {
        try {
          setError("");
          setSaving(true);
          const updated = await costingService.reopenCostingRequest(id, currentUser);
          setRequest(updated);
          setIsCorrectingDetails(false);
          setSuccessMsg("Completed request has been reopened successfully.");
        } catch (err) {
          setError(err.message || "Failed to reopen request.");
        } finally {
          setSaving(false);
        }
      }
    });
  };

  const handleAddSpecRow = () => {
    const newRow = { itemNo: tableData.length + 1 };
    marketingFields.forEach(f => {
      newRow[`spec_${f.key}`] = "";
    });
    financeFields.forEach(f => {
      newRow[`cost_${f.key}`] = "";
    });
    setTableData(prev => [...prev, newRow]);
  };

  const handleDeleteSpecRow = () => {
    const hot = hotTableRef.current?.hotInstance;
    if (!hot) return;
    const selected = hot.getSelected();
    if (!selected || selected.length === 0) {
      Modal.warning({ title: "No Row Selected", content: "Please select a cell in the row you wish to delete." });
      return;
    }
    const rowIndex = selected[0][0];
    if (tableData.length <= 1) {
      Modal.warning({ title: "Cannot Delete", content: "A costing request must have at least one specification row." });
      return;
    }
    const updated = tableData.filter((_, idx) => idx !== rowIndex).map((row, idx) => ({ ...row, itemNo: idx + 1 }));
    setTableData(updated);
  };

  const handleCorrectionSubmit = async () => {
    try {
      setError("");
      setSaving(true);
      
      const hot = hotTableRef.current?.hotInstance;
      let finalSpecsDraft = specsDraft;
      let finalCostingDraft = costingDraft;
      
      if (hot) {
        const gridData = hot.getSourceData();
        if (request.specs?.items || gridData.length > 1) {
          const updatedSpecsItems = [];
          const updatedCostingItems = {};
          
          gridData.forEach((row, idx) => {
            const specObj = {};
            marketingFields.forEach(f => {
              specObj[f.key] = row[`spec_${f.key}`] !== undefined ? row[`spec_${f.key}`] : "";
            });
            updatedSpecsItems.push(specObj);
            
            const packingConfig = specObj.packingConfiguration || row.spec_packingConfiguration || costingPacking.getDefaultPackingOption(request.productUnit);
            const rules = costingPacking.getFinanceFieldRules(packingConfig);

            const costObj = {};
            financeFields.forEach(f => {
              let val = row[`cost_${f.key}`];
              if (rules.nonApplicable.includes(f.key)) {
                val = f.type === "number" ? 0 : "0";
              } else if (f.type === "number" && val !== "" && val !== undefined && val !== null) {
                val = Number(val);
              }
              costObj[f.key] = val !== undefined ? val : "";
            });
            updatedCostingItems[idx] = costingPacking.applyAutoZeroToCosting(costObj, packingConfig);
          });
          
          finalSpecsDraft = { items: updatedSpecsItems };
          finalCostingDraft = { ...costingDraft, items: updatedCostingItems };
        } else {
          const row = gridData[0] || {};
          const specObj = {};
          marketingFields.forEach(f => {
            specObj[f.key] = row[`spec_${f.key}`] !== undefined ? row[`spec_${f.key}`] : "";
          });
          finalSpecsDraft = specObj;
          
          const packingConfig = specObj.packingConfiguration || row.spec_packingConfiguration || costingPacking.getDefaultPackingOption(request.productUnit);
          const rules = costingPacking.getFinanceFieldRules(packingConfig);

          const costObj = {};
          financeFields.forEach(f => {
            let val = row[`cost_${f.key}`];
            if (rules.nonApplicable.includes(f.key)) {
              val = f.type === "number" ? 0 : "0";
            } else if (f.type === "number" && val !== "" && val !== undefined && val !== null) {
              val = Number(val);
            }
            costObj[f.key] = val !== undefined ? val : "";
          });
          finalCostingDraft = { ...costingDraft, ...costingPacking.applyAutoZeroToCosting(costObj, packingConfig) };
        }
      }

      // Validate specs if correcting details
      const correctionErrors = [];
      const specItemsToCheck = finalSpecsDraft.items || [finalSpecsDraft];
      specItemsToCheck.forEach((item, idx) => {
        if (item.specifications && !costingPacking.containsLxWxHSequence(item.specifications)) {
          correctionErrors.push(`Item #${idx + 1}: "Product Specifications" must contain the L x W x H dimension sequence (e.g. 57X51X58 CM or 30x30x5 CM).`);
        }
      });

      if (correctionErrors.length > 0) {
        Modal.error({
          title: "Cannot Save Changes",
          content: (
            <div>
              <p style={{ color: "#334155", fontWeight: 600 }}>Please fix the following specifications:</p>
              <ul>
                {correctionErrors.map((err, i) => <li key={i}><strong>{err}</strong></li>)}
              </ul>
            </div>
          ),
          okText: "Review & Fix"
        });
        setSaving(false);
        return;
      }

      await costingService.updateRequestSpecs(id, finalSpecsDraft);
      if (isFinanceOfficer || isAdmin) {
        await costingService.saveCostingDataDraft(id, finalCostingDraft);
      }
      
      const updated = await costingService.getCostingRequestById(id);
      setRequest(updated);
      setIsCorrectingDetails(false);
      setSuccessMsg("Request specifications and details updated successfully.");
    } catch (err) {
      console.error(err);
      setError(err.message || "Failed to save corrections.");
    } finally {
      setSaving(false);
    }
  };

  const handleNudgeFinance = async () => {
    try {
      setError("");
      setSaving(true);
      const targetUser = request.financeOfficer?.uid || null;
      const targetRole = request.financeOfficer?.uid ? null : "finance";
      
      await notificationService.createNotification({
        userId: targetUser,
        role: targetRole,
        costRequestId: request.id,
        costRequestNo: request.costRequestNo,
        message: `Marketing Officer ${currentUser.displayName || currentUser.email} is requesting an update on costing for Request #${request.costRequestNo}.`
      });
      setSuccessMsg("Nudge notification sent to Finance successfully.");
    } catch (err) {
      console.error(err);
      setError("Failed to send nudge notification.");
    } finally {
      setSaving(false);
    }
  };

  // Unified, well-formatted Excel Cost Sheet Downloader
  const handleDownloadCostSheet = async () => {
    if (!request) return;

    if (request.specs?.excelFile) {
      handleDownloadExcel(request.specs.excelFile);
      if (request.costing?.excelFile) {
        handleDownloadExcel(request.costing.excelFile);
      }
      return;
    }

    try {
      setError("");
      setSaving(true);

      const workbook = new ExcelJS.Workbook();
      const worksheet = workbook.addWorksheet("Cost Sheet");
      worksheet.views = [{ showGridLines: true }];

      // 1. Header Banner
      const titleRow = worksheet.addRow(["HAYFIBRE OPERATIONS - PRODUCT COSTING SHEET"]);
      titleRow.font = { name: "Arial", size: 14, bold: true, color: { argb: "FFFFFFFF" } };
      titleRow.height = 32;
      titleRow.alignment = { vertical: "middle", horizontal: "center" };
      titleRow.fill = {
        type: "pattern",
        pattern: "solid",
        fgColor: { argb: "FF0F172A" } // Dark Slate Navy
      };

      worksheet.addRow([]); // Blank row

      // 2. Metadata Information Block
      const reqDateStr = request.requestDate ? new Date(request.requestDate).toLocaleDateString() : "-";
      const compDateStr = request.completionDate ? new Date(request.completionDate).toLocaleDateString() : "Pending";
      const catName = activeCategory?.name || request.productUnit || "-";
      const mktOfficer = request.marketingOfficer?.name || "-";
      const finOfficer = request.financeOfficer?.name || "Unassigned";

      const metaRowsData = [
        ["Cost Request No:", request.costRequestNo, "Request Date:", reqDateStr],
        ["Customer Name:", request.customerName, "Completion Date:", compDateStr],
        ["Product Category:", catName, "Status:", request.status],
        ["Marketing Officer:", mktOfficer, "Finance Officer:", finOfficer]
      ];

      metaRowsData.forEach((rowVals, idx) => {
        const mRow = worksheet.addRow(rowVals);
        mRow.height = 20;

        // Style label cell 1 (col A)
        const cA = mRow.getCell(1);
        cA.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF334155" } };
        cA.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        cA.border = { top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } }, left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } };

        // Style value cell 1 (col B)
        const cB = mRow.getCell(2);
        cB.font = { name: "Arial", size: 9.5, bold: idx === 0, color: { argb: idx === 0 ? "FF4F46E5" : "FF0F172A" } };
        cB.border = { top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } }, left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } };

        // Style label cell 2 (col C)
        const cC = mRow.getCell(3);
        cC.font = { name: "Arial", size: 9.5, bold: true, color: { argb: "FF334155" } };
        cC.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FFF1F5F9" } };
        cC.border = { top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } }, left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } };

        // Style value cell 2 (col D)
        const cD = mRow.getCell(4);
        cD.font = { name: "Arial", size: 9.5, color: { argb: "FF0F172A" } };
        cD.border = { top: { style: "thin", color: { argb: "FFE2E8F0" } }, bottom: { style: "thin", color: { argb: "FFE2E8F0" } }, left: { style: "thin", color: { argb: "FFE2E8F0" } }, right: { style: "thin", color: { argb: "FFE2E8F0" } } };
      });

      worksheet.addRow([]); // Blank spacer

      // 3. Items & Specifications Table (Safely normalize arrays)
      let itemsList = [];
      if (Array.isArray(request.specs?.items)) {
        itemsList = request.specs.items;
      } else if (request.specs?.items && typeof request.specs.items === "object") {
        itemsList = Object.values(request.specs.items);
      } else if (request.specs && typeof request.specs === "object") {
        itemsList = [request.specs];
      } else {
        itemsList = [{}];
      }

      const getItemCosting = (idx) => {
        if (!request.costing) return {};
        if (request.costing.items) {
          if (Array.isArray(request.costing.items)) {
            return request.costing.items[idx] || {};
          } else if (typeof request.costing.items === "object") {
            return request.costing.items[idx] || request.costing.items[String(idx)] || Object.values(request.costing.items)[idx] || {};
          }
        }
        return request.costing || {};
      };

      const costingList = itemsList.map((_, idx) => getItemCosting(idx));

      // Identify active columns (exclude empty columns)
      const activeMarketingFields = marketingFields.filter(f => {
        return itemsList.some(item => item && item[f.key] !== undefined && item[f.key] !== null && item[f.key] !== "" && item[f.key] !== "-");
      });

      const activeFinanceFields = financeFields.filter(f => {
        return costingList.some(cItem => {
          const val = cItem ? cItem[f.key] : undefined;
          return val !== undefined && val !== null && val !== "" && val !== "-";
        });
      });

      const headers = ["Item #"];
      activeMarketingFields.forEach(f => headers.push(`${f.label} (Mkt)`));
      activeFinanceFields.forEach(f => headers.push(`${f.label} (Fin)`));

      // Merge title row across total columns
      const totalCols = Math.max(headers.length, 4);
      worksheet.mergeCells(1, 1, 1, totalCols);

      const headerRow = worksheet.addRow(headers);
      headerRow.height = 26;
      headerRow.eachCell((cell) => {
        cell.fill = {
          type: "pattern",
          pattern: "solid",
          fgColor: { argb: "FF0284C7" } // Professional Sky/Ocean blue
        };
        cell.font = {
          name: "Arial",
          size: 10,
          bold: true,
          color: { argb: "FFFFFFFF" }
        };
        cell.alignment = { vertical: "middle", horizontal: "center" };
        cell.border = {
          top: { style: "thin", color: { argb: "FFE2E8F0" } },
          bottom: { style: "medium", color: { argb: "FF0369A1" } },
          left: { style: "thin", color: { argb: "FFE2E8F0" } },
          right: { style: "thin", color: { argb: "FFE2E8F0" } }
        };
      });

      // 4. Data Rows
      itemsList.forEach((item, idx) => {
        const itemCosting = getItemCosting(idx);
        const rowData = [idx + 1];

        activeMarketingFields.forEach(f => {
          rowData.push(item && item[f.key] !== undefined && item[f.key] !== null ? item[f.key] : "");
        });

        activeFinanceFields.forEach(f => {
          let val = itemCosting ? itemCosting[f.key] : "";
          if (f.key === "unitCost" && val !== undefined && val !== "" && val !== null) {
            val = `$${Number(val).toFixed(2)}`;
          }
          rowData.push(val !== undefined && val !== null ? val : "");
        });

        const dataRow = worksheet.addRow(rowData);
        dataRow.height = 22;

        const isZebra = idx % 2 === 1;
        dataRow.eachCell((cell, colIdx) => {
          cell.font = { name: "Arial", size: 9.5 };
          cell.alignment = { 
            vertical: "middle", 
            horizontal: colIdx === 1 ? "center" : (typeof cell.value === "number" || (typeof cell.value === "string" && cell.value.startsWith("$")) ? "right" : "left") 
          };
          if (isZebra) {
            cell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFF8FAFC" }
            };
          }
          cell.border = {
            top: { style: "thin", color: { argb: "FFE2E8F0" } },
            bottom: { style: "thin", color: { argb: "FFE2E8F0" } },
            left: { style: "thin", color: { argb: "FFE2E8F0" } },
            right: { style: "thin", color: { argb: "FFE2E8F0" } }
          };
        });
      });

      // 5. Auto Column Widths
      worksheet.columns.forEach((col, colIdx) => {
        let maxLen = 14;
        worksheet.eachRow((row, rIdx) => {
          if (rIdx >= 3) {
            const cellVal = row.getCell(colIdx + 1).value;
            if (cellVal) {
              maxLen = Math.max(maxLen, cellVal.toString().length + 4);
            }
          }
        });
        col.width = Math.min(Math.max(maxLen, 14), 45);
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
      const link = document.createElement("a");
      link.href = URL.createObjectURL(blob);
      link.download = `Cost_Sheet_CR_${request.costRequestNo}_${(request.customerName || "Customer").replace(/\s+/g, "_")}.xlsx`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      
      setSuccessMsg("Customer Cost Sheet downloaded successfully.");
    } catch (err) {
      console.error("Error exporting cost sheet:", err);
      setError("Failed to generate and download Customer Cost Sheet.");
    } finally {
      setSaving(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case "Submitted": return "processing";
      case "Received by Finance": return "warning";
      case "Costing in Progress": return "purple";
      case "Costing Completed":
      case "Sent to Marketing": return "success";
      case "Overdue": return "error";
      default: return "default";
    }
  };

  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: "50px 0" }}>
        <Spin size="large" tip="Loading request details..." />
      </div>
    );
  }

  // Setup grid columns dynamically
  const gridColumns = [];
  gridColumns.push({
    data: "itemNo",
    title: "#",
    readOnly: true,
    width: 45,
    className: "htCenter htMiddle"
  });

  marketingFields.forEach(f => {
    const col = {
      data: `spec_${f.key}`,
      title: `${f.label} (Mkt)`,
      readOnly: !isCorrectingDetails,
      className: "htCenter htMiddle"
    };
    if (f.key === "packingConfiguration") {
      col.width = 200;
      col.type = "dropdown";
      col.source = f.options || costingPacking.getPackingOptionsForCategory(request?.productUnit);
      col.visibleRows = 10;
    } else if (f.type === "number") {
      col.type = "numeric";
      col.width = 120;
    } else if (f.type === "select") {
      col.type = "dropdown";
      col.source = f.options || [];
      col.visibleRows = 10;
      col.width = 140;
    } else {
      col.type = "text";
      col.width = f.key === "description" || f.key === "specifications" ? 220 : 150;
    }
    gridColumns.push(col);
  });

  financeFields.forEach(f => {
    const col = {
      data: `cost_${f.key}`,
      title: `${f.label} (Fin)`,
      readOnly: !isCostingActive && !isCorrectingDetails,
      className: "htCenter htMiddle"
    };
    if (f.type === "number") {
      col.type = "numeric";
      col.width = 130;
    } else if (f.type === "select") {
      col.type = "dropdown";
      col.source = f.options || [];
      col.visibleRows = 10;
      col.width = 140;
    } else {
      col.type = "text";
      col.width = 160;
    }
    gridColumns.push(col);
  });

  return (
    <div style={{ paddingBottom: 48 }}>
      {/* Header */}
      <Row justify="space-between" align="middle" style={{ marginBottom: 32, gap: 16 }}>
        <Col>
          <Space size="middle">
            <Button
              icon={<LeftOutlined />}
              onClick={() => navigate("/costing-requests")}
              style={{ borderRadius: 8, border: "1px solid #cbd5e1", background: "transparent" }}
            >
              Back
            </Button>
            <Title level={2} style={{ margin: 0, fontWeight: 800, color: "#0f172a", letterSpacing: "-0.03em" }}>
              Request #{request.costRequestNo}
            </Title>
            <Tag color={getStatusColor(request.status)} style={{ fontWeight: 700 }}>
              {request.status}
            </Tag>
          </Space>
        </Col>

        <Col>
          <Space>
            {["Submitted", "Costing in Progress", "Overdue"].includes(request.status) && (
              <Button
                type="primary"
                ghost
                onClick={handleNudgeFinance}
                loading={saving}
                style={{ borderRadius: 8 }}
              >
                Nudge Finance
              </Button>
            )}

            {isCompleted && (
              <Button
                type="primary"
                icon={<FileDoneOutlined />}
                onClick={() => navigate(`/costing-requests/${id}/quotation`)}
                size="large"
                style={{ 
                  borderRadius: 8, 
                  background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", 
                  borderColor: "#0284c7",
                  fontWeight: 700 
                }}
              >
                Price Quotation
              </Button>
            )}

            {(isCompleted || isAdmin) && (
              <Button
                type="primary"
                icon={<DownloadOutlined />}
                onClick={handleDownloadCostSheet}
                loading={saving}
                size="large"
                style={{ 
                  borderRadius: 8, 
                  background: "linear-gradient(135deg, #059669 0%, #10b981 100%)", 
                  borderColor: "#059669",
                  fontWeight: 700 
                }}
              >
                Download Cost Sheet
              </Button>
            )}

            {canReopen && (
              <Button
                icon={<RollbackOutlined />}
                onClick={handleReopen}
                danger
                size="large"
                style={{ borderRadius: 8 }}
              >
                Reopen Request
              </Button>
            )}

            {showCorrectDetails && (
              <Button
                type="dashed"
                icon={<EditOutlined />}
                onClick={() => {
                  setIsCorrectingDetails(true);
                  setSpecsDraft(request.specs || {});
                  setCostingDraft(request.costing || {});
                }}
                size="large"
                style={{ borderRadius: 8 }}
              >
                Correct Details
              </Button>
            )}
          </Space>
        </Col>
      </Row>

      {error && <Alert message={error} type="error" showIcon style={{ marginBottom: 24, borderRadius: 8 }} />}
      {successMsg && <Alert message={successMsg} type="success" showIcon closable onClose={() => setSuccessMsg("")} style={{ marginBottom: 24, borderRadius: 8 }} />}

      <Row gutter={[24, 24]}>
        {/* Requisition details */}
        <Col span={24}>
          <Card 
            title="General Summary" 
            bordered={true}
            style={{ borderLeft: "4px solid #475569", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
          >
            <Descriptions column={{ xs: 1, sm: 2, md: 3 }} layout="vertical" bordered={false}>
              <Descriptions.Item label="CUSTOMER"><strong style={{ color: "#0f172a" }}>{request.customerName}</strong></Descriptions.Item>
              <Descriptions.Item label="PRODUCT CATEGORY"><Tag color="geekblue" style={{ fontWeight: 700 }}>{activeCategory?.name || request.productUnit}</Tag></Descriptions.Item>
              <Descriptions.Item label="MARKETING OFFICER"><span>{request.marketingOfficer.name}</span></Descriptions.Item>
              <Descriptions.Item label="FINANCE OFFICER"><span>{request.financeOfficer?.name || "Unassigned"}</span></Descriptions.Item>
              <Descriptions.Item label="REQUEST DATE"><span>{request.requestDate ? new Date(request.requestDate).toLocaleString() : "-"}</span></Descriptions.Item>
              <Descriptions.Item label="COMPLETION DATE"><span>{request.completionDate ? new Date(request.completionDate).toLocaleString() : "Pending"}</span></Descriptions.Item>
            </Descriptions>
          </Card>
        </Col>

        {/* Quotation Ready Action Banner */}
        {isCompleted && (
          <Col span={24}>
            <Card 
              bordered={true}
              style={{ 
                borderRadius: 12, 
                borderLeft: "4px solid #0284c7", 
                background: "linear-gradient(135deg, rgba(2, 132, 199, 0.05) 0%, rgba(3, 105, 161, 0.02) 100%)",
                borderColor: "#bae6fd" 
              }}
            >
              <Row justify="space-between" align="middle" gutter={[16, 16]}>
                <Col xs={24} md={18}>
                  <Space align="start" size="middle">
                    <FileDoneOutlined style={{ fontSize: 28, color: "#0284c7", marginTop: 4 }} />
                    <div>
                      <Title level={4} style={{ margin: 0, color: "#0369a1", fontWeight: 700 }}>
                        Official Price Quotation Generator Ready
                      </Title>
                      <Text style={{ color: "#475569" }}>
                        Costing has been completed. Marketing can now generate official Price Quotations in Bedding or Horticulture format with live 20ft/40ft container calculations, FOB/CIF/EXW pricing terms, and export to Excel (.xlsx) and PDF.
                      </Text>
                    </div>
                  </Space>
                </Col>
                <Col xs={24} md={6} style={{ textAlign: "right" }}>
                  <Button
                    type="primary"
                    icon={<FileDoneOutlined />}
                    onClick={() => navigate(`/costing-requests/${id}/quotation`)}
                    size="large"
                    block
                    style={{ 
                      borderRadius: 8, 
                      background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)", 
                      borderColor: "#0284c7",
                      fontWeight: 700 
                    }}
                  >
                    Open Price Quotation
                  </Button>
                </Col>
              </Row>
            </Card>
          </Col>
        )}

        {/* Excel upload interface if file-based costing */}
        {request.specs?.excelFile && (
          <Col span={24}>
            <Row gutter={[24, 24]}>
              <Col xs={24} md={12}>
                <Card title="Marketing Specifications File" bordered={true} style={{ borderRadius: 12 }}>
                  <Alert
                    message="Specifications Document Uploaded by Marketing"
                    description={
                      <div style={{ marginTop: 12 }}>
                        <Space style={{ marginBottom: 12 }}>
                          <FileTextOutlined style={{ fontSize: 24, color: "#0ea5e9" }} />
                          <Text strong>{request.specs.excelFile.name}</Text>
                        </Space>
                        <div>
                          <Button
                            type="primary"
                            icon={<DownloadOutlined />}
                            onClick={() => handleDownloadExcel(request.specs.excelFile)}
                            style={{ borderRadius: 6 }}
                          >
                            Download Specifications Excel
                          </Button>
                        </div>
                      </div>
                    }
                    type="info"
                    showIcon
                  />
                </Card>
              </Col>
              <Col xs={24} md={12}>
                <Card title="Finance Costing File" bordered={true} style={{ borderRadius: 12 }}>
                  {((isFinanceOfficer && (request.status === "Costing in Progress" || request.status === "Overdue")) || isCorrectingDetails) ? (
                    <Space direction="vertical" size="middle" style={{ width: "100%" }}>
                      <Text type="secondary">
                        Finance costing is spreadsheet-based. Download the specifications sheet, perform calculations, and upload the completed costing sheet below.
                      </Text>

                      <Upload.Dragger
                        multiple={false}
                        beforeUpload={handleFinanceExcelUpload}
                        showUploadList={false}
                        accept=".xlsx,.xls"
                      >
                        <p className="ant-upload-drag-icon">
                          <InboxOutlined style={{ fontSize: 32, color: "#6366f1" }} />
                        </p>
                        <p className="ant-upload-text" style={{ fontWeight: 600, fontSize: "0.85rem" }}>Click or drag updated Excel sheet here</p>
                      </Upload.Dragger>

                      {costingDraft.excelFile && (
                        <Card size="small" style={{ border: "1px dashed #10b981", background: "rgba(16, 185, 129, 0.02)" }}>
                          <Space>
                            <FileTextOutlined style={{ color: "#10b981", fontSize: 18 }} />
                            <Text strong>{costingDraft.excelFile.name}</Text>
                          </Space>
                        </Card>
                      )}

                      <Row gutter={12}>
                        <Col span={12}>
                          <Button icon={<SaveOutlined />} onClick={handleSaveDraft} disabled={saving} block>Save Draft</Button>
                        </Col>
                        <Col span={12}>
                          <Button type="primary" icon={<CheckCircleOutlined />} onClick={handleCompleteCosting} disabled={saving} block style={{ background: "#10b981", borderColor: "#10b981" }}>Complete</Button>
                        </Col>
                      </Row>
                    </Space>
                  ) : (
                    <div>
                      {request.costing?.excelFile ? (
                        <Alert
                          message="Excel Costing Document"
                          description={
                            <div style={{ marginTop: 12 }}>
                              <Space style={{ marginBottom: 12 }}>
                                <FileTextOutlined style={{ fontSize: 24, color: "#a855f7" }} />
                                <Text strong>{request.costing.excelFile.name}</Text>
                              </Space>
                              <div>
                                <Button
                                  type="primary"
                                  icon={<DownloadOutlined />}
                                  onClick={() => handleDownloadExcel(request.costing.excelFile)}
                                  style={{ borderRadius: 6, background: "#a855f7", borderColor: "#a855f7" }}
                                >
                                  Download Completed Costing Excel
                                </Button>
                              </div>
                            </div>
                          }
                          type="info"
                          showIcon
                        />
                      ) : (
                        <Alert 
                          message="Finance has not uploaded the costing sheet yet."
                          type="warning"
                          showIcon
                        />
                      )}
                    </div>
                  )}
                </Card>
              </Col>
            </Row>
          </Col>
        )}

        {/* Handsontable Specifications & Costing Grid */}
        {!request.specs?.excelFile && (
          <Col span={24}>
            <Card 
              title="Specifications & Costing Grid" 
              bordered={true}
              style={{ borderLeft: "4px solid #0ea5e9", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
              extra={
                isCorrectingDetails ? (
                  <Space wrap>
                    <Tag color="orange" style={{ fontWeight: 800 }}>EDITING MODE</Tag>
                    <Button 
                      type="dashed" 
                      onClick={handleAddSpecRow} 
                      icon={<PlusOutlined />} 
                      style={{ borderRadius: 6 }}
                    >
                      Add Row
                    </Button>
                    <Button 
                      type="dashed" 
                      danger 
                      onClick={handleDeleteSpecRow} 
                      icon={<DeleteOutlined />} 
                      style={{ borderRadius: 6 }}
                    >
                      Delete Row
                    </Button>
                  </Space>
                ) : isCostingActive ? (
                  <Tag color="processing" style={{ fontWeight: 800 }}>COSTING PHASE ACTIVE</Tag>
                ) : null
              }
            >
              {isCorrectingDetails && (
                <Alert
                  message="Specification Editing Active"
                  description="You can edit specification values and add or remove rows in the grid below. Click 'Save Changes' below once finished."
                  type="warning"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}
              {isCostingActive && !isCorrectingDetails && (
                <Alert
                  message="Finance Costing Mode Active"
                  description={
                    <div>
                      <div>Double-click on the Finance column cells to input required costing values. Non-applicable fields for each line's Packing Configuration are locked and automatically zeroed:</div>
                      <div style={{ marginTop: 6, fontSize: "0.82rem", color: "#475569" }}>
                        • <strong>Carton Floor Loaded:</strong> Carton Size & Unit Cost required.<br />
                        • <strong>Carton Pallet Loading:</strong> Carton Size, Pallet Size, Cartons per Pallet & Unit Cost required.<br />
                        • <strong>Bundle Floor Loaded:</strong> Bundle Size (in Carton/Bundle size column) & Unit Cost required.<br />
                        • <strong>Bundle Pallet Loading:</strong> Bundle Size, Pallet Size, Bundles per Pallet & Unit Cost required.<br />
                        • <strong>Roll Floor Loaded:</strong> Roll Diameter, Roll Length & Unit Cost required.<br />
                        • <strong>Roll Pallet Loading:</strong> Roll Diameter, Roll Length, Pallet Size & Unit Cost required.
                      </div>
                    </div>
                  }
                  type="info"
                  showIcon
                  style={{ marginBottom: 16 }}
                />
              )}

              <style>{`
                .non-applicable-finance-cell {
                  background-color: #f1f5f9 !important;
                  color: #94a3b8 !important;
                  font-style: italic;
                  cursor: not-allowed !important;
                }
                .required-finance-cell {
                  background-color: #f0fdf4 !important;
                  color: #0f172a !important;
                  font-weight: 600;
                }
              `}</style>

              <div className="hot-container">
                <HotTable
                  ref={hotTableRef}
                  data={tableData}
                  columns={gridColumns}
                  colHeaders={gridColumns.map(c => c.title)}
                  rowHeaders={false}
                  height="auto"
                  licenseKey="non-commercial-and-evaluation"
                  colWidths={(index) => gridColumns[index]?.width || 150}
                  afterChange={handleDetailsTableChange}
                  manualColumnResize={true}
                  cells={function (row, col, prop) {
                    const cellProperties = {};
                    if (!tableData || !tableData[row]) return cellProperties;

                    const rowItem = tableData[row];
                    const packingConfig = rowItem.spec_packingConfiguration || (request?.specs?.items ? request.specs.items[row]?.packingConfiguration : request?.specs?.packingConfiguration) || costingPacking.getDefaultPackingOption(request?.productUnit);
                    const rules = costingPacking.getFinanceFieldRules(packingConfig);

                    if (prop && prop.startsWith("cost_")) {
                      const fieldKey = prop.replace("cost_", "");
                      if (rules.nonApplicable.includes(fieldKey)) {
                        cellProperties.readOnly = true;
                        cellProperties.className = "htCenter htMiddle non-applicable-finance-cell";
                      } else if (rules.required.includes(fieldKey)) {
                        cellProperties.className = "htCenter htMiddle required-finance-cell";
                      } else {
                        cellProperties.className = "htCenter htMiddle";
                      }
                    }
                    return cellProperties;
                  }}
                />
              </div>

              {/* Action Buttons below table */}
              {(isCostingActive || isCorrectingDetails) && (
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: 16 }}>
                  {isCorrectingDetails ? (
                    <>
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={handleCorrectionSubmit}
                        disabled={saving}
                        style={{ background: "#10b981", borderColor: "#10b981", fontWeight: 700 }}
                      >
                        Save Changes
                      </Button>
                      <Button
                        icon={<CloseCircleOutlined />}
                        onClick={() => {
                          setIsCorrectingDetails(false);
                          setSpecsDraft(request.specs || {});
                          setCostingDraft(request.costing || {});
                        }}
                      >
                        Cancel
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        icon={<SaveOutlined />}
                        onClick={handleSaveDraft}
                        disabled={saving}
                        style={{ borderColor: "#6366f1", color: "#6366f1", fontWeight: 700 }}
                      >
                        Save Draft
                      </Button>
                      <Button
                        type="primary"
                        icon={<CheckCircleOutlined />}
                        onClick={handleCompleteCosting}
                        disabled={saving}
                        style={{ background: "#10b981", borderColor: "#10b981", fontWeight: 700 }}
                      >
                        Complete Costing
                      </Button>
                    </>
                  )}
                </div>
              )}
            </Card>
          </Col>
        )}

        {/* Workflow Lifecycle Step Actions for Finance */}
        {isFinanceOfficer && !isCompleted && (
          <Col span={24}>
            <Card 
              title={<span style={{ color: "#f59e0b" }}>Workflow Action</span>} 
              bordered={true}
              style={{ borderLeft: "4px solid #f59e0b", background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: 12 }}
            >
              {request.status === "Submitted" && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleReceive}
                  disabled={saving}
                  size="large"
                  style={{ background: "#f59e0b", borderColor: "#f59e0b", fontWeight: 700, borderRadius: 8, height: 48 }}
                >
                  Receive Request
                </Button>
              )}

              {request.status === "Received by Finance" && (
                <Button
                  type="primary"
                  icon={<PlayCircleOutlined />}
                  onClick={handleStartCosting}
                  disabled={saving}
                  size="large"
                  style={{ background: "#6366f1", borderColor: "#6366f1", fontWeight: 700, borderRadius: 8, height: 48 }}
                >
                  Start Costing Phase
                </Button>
              )}

              {["Costing in Progress", "Overdue"].includes(request.status) && (
                <Text type="secondary" style={{ fontWeight: 500, lineHeight: 1.5, display: "block" }}>
                  {request.specs?.excelFile 
                    ? "Download specifications spreadsheet, perform calculations, and upload the final calculated costing sheet on the right."
                    : "Costing phase is active. Input costing parameters inside the Finance columns in the grid above, then click 'Complete Costing'."
                  }
                </Text>
              )}
            </Card>
          </Col>
        )}
      </Row>
    </div>
  );
}
