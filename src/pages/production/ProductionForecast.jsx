import React, { useState, useEffect, useRef, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { 
  Card, 
  Button, 
  Space, 
  Typography, 
  Row, 
  Col, 
  Statistic, 
  Tag, 
  Select, 
  Input, 
  Modal, 
  Form, 
  InputNumber, 
  message, 
  Tooltip, 
  Popconfirm, 
  Divider, 
  Radio, 
  Segmented, 
  Upload, 
  Table,
  Checkbox
} from "antd";
import {
  PlusOutlined,
  SaveOutlined,
  DownloadOutlined,
  ReloadOutlined,
  DashboardOutlined,
  CalendarOutlined,
  CheckCircleOutlined,
  WarningOutlined,
  SearchOutlined,
  TableOutlined,
  ArrowUpOutlined,
  ArrowDownOutlined,
  FundProjectionScreenOutlined,
  SyncOutlined,
  CloudUploadOutlined,
  FilePptOutlined,
  FileExcelOutlined,
  DeleteOutlined,
  LockOutlined,
  SwapRightOutlined
} from "@ant-design/icons";
import dayjs from "dayjs";

// Handsontable imports
import { HotTable } from "@handsontable/react";
import { registerAllModules } from "handsontable/registry";
import "handsontable/styles/handsontable.min.css";
import "handsontable/styles/ht-theme-main.min.css";

import { 
  FINANCIAL_YEAR_MONTHS, 
  SALES_OFFICERS, 
  DEPARTMENTS, 
  getDepartmentForOfficer, 
  calculateRowMetrics, 
  getDefaultRollingMonths, 
  getCurrentMonthKey,
  getCurrentMonthObject,
  getMonthRange,
  formatCurrency, 
  formatCompactCurrency, 
  formatPercentage, 
  exportForecastToExcel 
} from "../../utils/productionPlanData";
import { 
  getProductionForecasts, 
  saveProductionForecast, 
  batchSaveProductionForecasts, 
  deleteProductionForecast, 
  resetToExcelBaseline 
} from "../../services/firebase/productionPlanService";
import { exportForecastToPowerPoint } from "../../utils/powerPointGenerator";
import { downloadForecastExcelTemplate, parseProductionForecastExcel } from "../../utils/productionPlanExcel";

registerAllModules();

const { Title, Text } = Typography;
const { Option } = Select;
const { Dragger } = Upload;

export default function ProductionForecast({ fixedRoleView, pageTitle, pageSubtitle }) {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const hotTableRef = useRef(null);
  const [form] = Form.useForm();

  const [loading, setLoading] = useState(true);
  const [allData, setAllData] = useState([]);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [saving, setSaving] = useState(false);
  const [exportingPpt, setExportingPpt] = useState(false);
  const [autoSaveStatus, setAutoSaveStatus] = useState("idle"); // "idle" | "saving" | "saved" | "error"
  const [lastSavedTime, setLastSavedTime] = useState(null);

  const autoSaveTimeoutRef = useRef(null);
  const pendingSavesRef = useRef(new Map());

  // Role resolution & View access configuration
  const userRoles = currentUser?.roles || [];
  const prodRoles = currentUser?.productionRoles || [];
  const isSuperAdmin = currentUser?.email === "admin@gmail.com" || userRoles.includes("admin");
  const isProdAdmin = isSuperAdmin || prodRoles.includes("production_all") || prodRoles.includes("admin");
  const isFactoryTeam = !isProdAdmin && prodRoles.includes("production_factory");
  const isMarketingTeam = !isProdAdmin && !isFactoryTeam && (prodRoles.includes("production_marketing") || userRoles.includes("costing_marketing") || userRoles.includes("sample_marketing"));

  // Strictly designate view based on user role or fixedRoleView prop
  const designatedRoleView = useMemo(() => {
    if (fixedRoleView) return fixedRoleView;
    if (isProdAdmin) return "all_editable";
    if (isFactoryTeam) return "factory_performance";
    if (isMarketingTeam) return "marketing_actuals";
    return "read_only";
  }, [fixedRoleView, isProdAdmin, isFactoryTeam, isMarketingTeam]);

  const [activeRoleView, setActiveRoleView] = useState(designatedRoleView);

  useEffect(() => {
    if (fixedRoleView) {
      setActiveRoleView(fixedRoleView);
    } else if (!isProdAdmin) {
      setActiveRoleView(designatedRoleView);
    }
  }, [fixedRoleView, designatedRoleView, isProdAdmin]);

  // Time Filters - Default to Current Month & Year
  const currentMonthKey = useMemo(() => getCurrentMonthKey(), []);
  const default4Months = useMemo(() => getDefaultRollingMonths(), []);
  const defaultRollingKeys = useMemo(() => default4Months.map(m => m.monthKey), [default4Months]);
  
  const [viewMode, setViewMode] = useState("single"); // "single" (Default Current Month), "from_to", "rolling", "custom", "all"
  const [singleMonth, setSingleMonth] = useState(currentMonthKey);
  const [fromMonth, setFromMonth] = useState("2026-04");
  const [toMonth, setToMonth] = useState(currentMonthKey);
  const [selectedMonths, setSelectedMonths] = useState([currentMonthKey]);

  // Facet Filters
  const [selectedOfficer, setSelectedOfficer] = useState("all");
  const [selectedDepartment, setSelectedDepartment] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [searchText, setSearchText] = useState("");

  // Modal State for New Entry
  const [isModalVisible, setIsModalVisible] = useState(false);
  const [modalPreview, setModalPreview] = useState(null);

  // Modal State for Excel Upload
  const [isUploadModalVisible, setIsUploadModalVisible] = useState(false);
  const [parsedImportData, setParsedImportData] = useState(null);
  const [importMode, setImportMode] = useState("merge"); // "merge" | "append" | "replace"
  const [importLoading, setImportLoading] = useState(false);

  // Modal State for Deleting Entries
  const [isDeleteModalVisible, setIsDeleteModalVisible] = useState(false);

  useEffect(() => {
    loadData();
    return () => {
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
    };
  }, []);

  const loadData = async () => {
    try {
      setLoading(true);
      const data = await getProductionForecasts();
      setAllData(data);
      setHasUnsavedChanges(false);
      setAutoSaveStatus("idle");
    } catch (err) {
      console.error("Failed to load production forecasts:", err);
      message.error("Failed to load forecast data");
    } finally {
      setLoading(false);
    }
  };

  // Trigger Debounced Auto-Save to Firebase
  const triggerAutoSave = (modifiedRows = []) => {
    modifiedRows.forEach(row => {
      pendingSavesRef.current.set(row.id, row);
    });

    setAutoSaveStatus("saving");

    if (autoSaveTimeoutRef.current) {
      clearTimeout(autoSaveTimeoutRef.current);
    }

    autoSaveTimeoutRef.current = setTimeout(async () => {
      try {
        const rowsToSave = Array.from(pendingSavesRef.current.values());
        if (rowsToSave.length > 0) {
          await batchSaveProductionForecasts(rowsToSave);
          pendingSavesRef.current.clear();
          setAutoSaveStatus("saved");
          setLastSavedTime(dayjs().format("HH:mm:ss"));
          setHasUnsavedChanges(false);
        }
      } catch (err) {
        console.error("Auto-save to Firebase failed:", err);
        setAutoSaveStatus("error");
      }
    }, 600);
  };

  // Compute active month keys based on viewMode
  const activeMonthKeys = useMemo(() => {
    if (viewMode === "single") {
      return [singleMonth];
    }
    if (viewMode === "from_to") {
      return getMonthRange(fromMonth, toMonth);
    }
    if (viewMode === "rolling") {
      return defaultRollingKeys;
    }
    if (viewMode === "custom") {
      return selectedMonths;
    }
    if (viewMode === "all") {
      return FINANCIAL_YEAR_MONTHS.map(m => m.monthKey);
    }
    return [singleMonth];
  }, [viewMode, singleMonth, fromMonth, toMonth, defaultRollingKeys, selectedMonths]);

  // Compute human-readable period label for PowerPoint & Reports
  const activePeriodLabel = useMemo(() => {
    if (viewMode === "single") {
      const m = FINANCIAL_YEAR_MONTHS.find(item => item.monthKey === singleMonth);
      return m ? `${m.name} ${m.defaultYear}` : singleMonth;
    }
    if (viewMode === "from_to") {
      const f = FINANCIAL_YEAR_MONTHS.find(item => item.monthKey === fromMonth);
      const t = FINANCIAL_YEAR_MONTHS.find(item => item.monthKey === toMonth);
      return `From ${f ? f.name + " " + f.defaultYear : fromMonth} To ${t ? t.name + " " + t.defaultYear : toMonth}`;
    }
    if (viewMode === "rolling") {
      return `Rolling 4-Months (${default4Months.map(m => m.month).join(", ")})`;
    }
    if (viewMode === "all") {
      return "Full Financial Year 2026-2027 (12 Months)";
    }
    return `Selected Months (${activeMonthKeys.length} Months)`;
  }, [viewMode, singleMonth, fromMonth, toMonth, default4Months, activeMonthKeys]);

  // Filtered rows to display in Handsontable
  const filteredData = useMemo(() => {
    let list = [...allData];

    if (viewMode !== "all") {
      list = list.filter(r => 
        activeMonthKeys.includes(r.monthKey) || 
        activeMonthKeys.includes(r.month) ||
        activeMonthKeys.includes(r.monthName)
      );
    }

    if (selectedOfficer !== "all") {
      list = list.filter(r => r.salesOfficer === selectedOfficer);
    }

    if (selectedDepartment !== "all") {
      list = list.filter(r => r.department === selectedDepartment);
    }

    if (selectedStatus !== "all") {
      list = list.filter(r => r.status === selectedStatus);
    }

    if (searchText.trim() !== "") {
      const q = searchText.toLowerCase().trim();
      list = list.filter(r => 
        (r.buyer && r.buyer.toLowerCase().includes(q)) ||
        (r.salesOfficer && r.salesOfficer.toLowerCase().includes(q)) ||
        (r.department && r.department.toLowerCase().includes(q)) ||
        (r.month && r.month.toLowerCase().includes(q)) ||
        (r.monthName && r.monthName.toLowerCase().includes(q)) ||
        (r.year && String(r.year).includes(q)) ||
        (r.notes && r.notes.toLowerCase().includes(q))
      );
    }

    return list;
  }, [allData, viewMode, activeMonthKeys, selectedOfficer, selectedDepartment, selectedStatus, searchText]);

  // Aggregate summary metrics for current filtered view
  const summaryMetrics = useMemo(() => {
    let bTo = 0;
    let bTeu = 0;
    let bCont = 0;
    let aTo = 0;
    let aTeu = 0;
    let aCont = 0;
    let fTo = 0;
    let fTeu = 0;
    let fCont = 0;
    let metCount = 0;
    let newCount = 0;
    let varCount = 0;
    let confirmedCount = 0;
    let confirmedTeu = 0;
    let confirmedTo = 0;

    filteredData.forEach(r => {
      bTo += parseFloat(r.budgetTurnover) || 0;
      bTeu += parseFloat(r.budgetTeu) || 0;
      bCont += parseFloat(r.budgetContribution) || 0;

      aTo += parseFloat(r.actualTurnover) || 0;
      aTeu += parseFloat(r.actualTeu) || 0;
      aCont += parseFloat(r.actualContribution) || 0;

      fTo += parseFloat(r.factoryTurnover) || 0;
      fTeu += parseFloat(r.factoryTeu) || 0;
      fCont += parseFloat(r.factoryContribution) || 0;

      if (r.factoryConfirmed) {
        confirmedCount++;
        confirmedTeu += parseFloat(r.factoryTeu) || 0;
        confirmedTo += parseFloat(r.factoryTurnover) || 0;
      }

      if (r.status === "met") metCount++;
      else if (r.status === "new") newCount++;
      else if (r.status === "variance") varCount++;
    });

    const vTo = aTo - bTo;
    const vTeu = aTeu - bTeu;
    const vCont = aCont - bCont;
    const achRate = bTo > 0 ? (aTo / bTo) * 100 : (aTo > 0 ? 100 : 0);
    const bMargin = bTo > 0 ? (bCont / bTo) : 0;
    const aMargin = aTo > 0 ? (aCont / aTo) : 0;

    return {
      bTo,
      bTeu: Math.round(bTeu * 100) / 100,
      bCont,
      bMargin,
      aTo,
      aTeu: Math.round(aTeu * 100) / 100,
      aCont,
      aMargin,
      fTo,
      fTeu: Math.round(fTeu * 100) / 100,
      fCont,
      vTo,
      vTeu: Math.round(vTeu * 100) / 100,
      vCont,
      achRate: Math.round(achRate * 10) / 10,
      metCount,
      newCount,
      varCount,
      confirmedCount,
      confirmedTeu: Math.round(confirmedTeu * 100) / 100,
      confirmedTo,
      totalRows: filteredData.length
    };
  }, [filteredData]);

  // Handsontable Change Handler: Live Recalculations & Instant Firebase Auto-Save
  const handleHandsontableChange = (changes, source) => {
    if (!changes || source === "loadData") return;

    const hot = hotTableRef.current?.hotInstance;
    if (!hot) return;

    const sourceData = hot.getSourceData();
    let hasChanges = false;
    const modifiedRows = [];

    changes.forEach(([rowIdx, prop, oldVal, newVal]) => {
      if (oldVal !== newVal) {
        hasChanges = true;
        const targetRow = sourceData[rowIdx];
        if (targetRow) {
          // If salesOfficer changed, update department
          if (prop === "salesOfficer") {
            targetRow.department = getDepartmentForOfficer(newVal);
          }
          // Recalculate row (includes proportional factory ratios)
          const recalculated = calculateRowMetrics(targetRow);
          Object.assign(targetRow, recalculated);
          modifiedRows.push(recalculated);
        }
      }
    });

    if (hasChanges) {
      setHasUnsavedChanges(true);
      // Synchronize in-memory allData state
      const updatedMap = new Map(sourceData.map(item => [item.id, item]));
      setAllData(prev => prev.map(item => updatedMap.has(item.id) ? updatedMap.get(item.id) : item));

      // Trigger instant background auto-save to Firebase
      triggerAutoSave(modifiedRows);
    }
  };

  // Save All Changes to Firestore / Storage
  const handleSaveAll = async () => {
    try {
      setSaving(true);
      if (autoSaveTimeoutRef.current) {
        clearTimeout(autoSaveTimeoutRef.current);
      }
      const hot = hotTableRef.current?.hotInstance;
      const currentGridData = hot ? hot.getSourceData() : filteredData;

      await batchSaveProductionForecasts(currentGridData);
      setHasUnsavedChanges(false);
      setAutoSaveStatus("saved");
      setLastSavedTime(dayjs().format("HH:mm:ss"));
      message.success("All production forecast changes saved successfully to Firebase!");
      await loadData();
    } catch (err) {
      console.error("Save error:", err);
      message.error("Failed to save changes.");
    } finally {
      setSaving(false);
    }
  };

  // Check if all filtered rows are confirmed for production
  const isAllConfirmed = useMemo(() => {
    return filteredData.length > 0 && filteredData.every(r => !!r.factoryConfirmed);
  }, [filteredData]);

  const someConfirmed = useMemo(() => {
    return filteredData.some(r => !!r.factoryConfirmed) && !isAllConfirmed;
  }, [filteredData, isAllConfirmed]);

  // Bulk Select All / Unselect All for Production Confirmation
  const handleToggleConfirmAllProduction = (shouldConfirm) => {
    if (filteredData.length === 0) {
      message.warning("No records to update in the current view.");
      return;
    }

    const targetIds = new Set(filteredData.map(r => r.id));
    const modifiedRows = [];

    const updatedAllData = allData.map(row => {
      if (targetIds.has(row.id)) {
        let newFactoryTeu = parseFloat(row.factoryTeu) || 0;
        if (shouldConfirm && newFactoryTeu === 0) {
          // If capable TEU wasn't set yet, default to actual or budget TEU
          newFactoryTeu = parseFloat(row.actualTeu) || parseFloat(row.budgetTeu) || 1.0;
        }
        const recalculated = calculateRowMetrics({
          ...row,
          factoryConfirmed: shouldConfirm,
          factoryTeu: newFactoryTeu
        });
        modifiedRows.push(recalculated);
        return recalculated;
      }
      return row;
    });

    setAllData(updatedAllData);
    setHasUnsavedChanges(true);
    triggerAutoSave(modifiedRows);

    if (shouldConfirm) {
      message.success(`Successfully confirmed ${filteredData.length} records for production (${activePeriodLabel})!`);
    } else {
      message.info(`Unconfirmed ${filteredData.length} records for production.`);
    }
  };

  // PowerPoint Presentation Export Handler
  const handleExportPowerPoint = async () => {
    try {
      setExportingPpt(true);
      const filename = `Production_Forecast_${activePeriodLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}.pptx`;
      await exportForecastToPowerPoint(filteredData, {
        periodLabel: activePeriodLabel,
        activeRoleView: activeRoleView,
        allDataset: allData,
        targetMonthKey: activeMonthKeys[0] || currentMonthKey,
        filename
      });
      message.success(`PowerPoint presentation for ${activePeriodLabel} exported successfully!`);
    } catch (err) {
      console.error("PowerPoint export error:", err);
      message.error("Failed to export PowerPoint presentation.");
    } finally {
      setExportingPpt(false);
    }
  };

  // Excel Template Download
  const handleDownloadTemplate = async () => {
    try {
      await downloadForecastExcelTemplate();
      message.success("Production forecast template downloaded successfully with in-cell dropdowns!");
    } catch (err) {
      console.error("Template download error:", err);
      message.error("Failed to download Excel template.");
    }
  };

  // Excel Import Handler
  const handleFileUpload = async (file) => {
    try {
      setImportLoading(true);
      const result = await parseProductionForecastExcel(file);
      setParsedImportData(result);
      if (result.warnings && result.warnings.length > 0) {
        message.warning(`Parsed ${result.totalParsed} rows with ${result.warnings.length} notes.`);
      } else {
        message.success(`Parsed ${result.totalParsed} records successfully.`);
      }
    } catch (err) {
      console.error("File parse error:", err);
      message.error(err.message || "Failed to parse uploaded Excel file.");
    } finally {
      setImportLoading(false);
    }
    return false; // Prevent default upload
  };

  // Confirm and Commit Excel Import
  const handleCommitImport = async () => {
    if (!parsedImportData || !parsedImportData.rows || parsedImportData.rows.length === 0) {
      message.warning("No rows to import.");
      return;
    }

    try {
      setImportLoading(true);
      const newRows = parsedImportData.rows;

      let datasetToSave = [];
      if (importMode === "replace") {
        datasetToSave = newRows;
      } else if (importMode === "merge") {
        // Merge matching buyer + monthKey, otherwise append
        const existingMap = new Map(allData.map(r => [`${(r.buyer || "").trim().toLowerCase()}_${r.monthKey}`, r]));
        newRows.forEach(nr => {
          const key = `${(nr.buyer || "").trim().toLowerCase()}_${nr.monthKey}`;
          if (existingMap.has(key)) {
            const existing = existingMap.get(key);
            existingMap.set(key, { ...existing, ...nr, id: existing.id });
          } else {
            existingMap.set(key, nr);
          }
        });
        datasetToSave = Array.from(existingMap.values());
      } else {
        // Append all
        datasetToSave = [...newRows, ...allData];
      }

      await batchSaveProductionForecasts(datasetToSave);
      message.success(`Successfully imported ${newRows.length} forecast records into the system!`);
      setIsUploadModalVisible(false);
      setParsedImportData(null);
      await loadData();
    } catch (err) {
      console.error("Import commit error:", err);
      message.error("Failed to save imported records.");
    } finally {
      setImportLoading(false);
    }
  };

  // Delete Individual Row
  const handleDeleteRow = async (id, buyerName) => {
    try {
      await deleteProductionForecast(id);
      setAllData(prev => prev.filter(r => r.id !== id));
      message.success(`Forecast entry for ${buyerName || "customer"} deleted.`);
    } catch (err) {
      console.error("Delete error:", err);
      message.error("Failed to delete forecast entry.");
    }
  };

  // Quick Add Row directly in active view
  const handleAddInlineRow = () => {
    const targetMonthKey = activeMonthKeys[0] || currentMonthKey;
    const mObj = FINANCIAL_YEAR_MONTHS.find(m => m.monthKey === targetMonthKey) || getCurrentMonthObject();

    const newRow = calculateRowMetrics({
      id: `fc-new-${Date.now()}`,
      year: mObj.defaultYear,
      month: mObj.code,
      monthName: `${mObj.name} ${mObj.defaultYear}`,
      monthKey: mObj.monthKey,
      salesOfficer: "MM",
      department: "Horticulture",
      buyer: "New Customer Account",
      budgetTeu: 1.0,
      budgetTurnover: 2500000,
      budgetContribution: 1000000,
      budgetMargin: 0.4,
      actualTeu: 0,
      actualTurnover: 0,
      actualContribution: 0,
      actualMargin: 0,
      factoryTeu: 0,
      factoryTurnover: 0,
      factoryConfirmed: false,
      notes: "Newly added forecast entry"
    });

    setAllData(prev => [newRow, ...prev]);
    setHasUnsavedChanges(true);
    message.info(`Added new row for ${mObj.name} ${mObj.defaultYear}. Click "Save All" when done.`);
  };

  // Open Modal for Detailed Entry Creation
  const handleOpenAddModal = () => {
    const targetMonthKey = activeMonthKeys[0] || currentMonthKey;
    form.resetFields();
    form.setFieldsValue({
      monthKey: targetMonthKey,
      salesOfficer: "MM",
      department: "Horticulture",
      buyer: "",
      budgetTeu: 1.0,
      budgetTurnover: 2500000,
      budgetContribution: 1000000,
      actualTeu: 0,
      actualTurnover: 0,
      actualContribution: 0,
      factoryTeu: 0,
      notes: ""
    });
    calculateModalPreview();
    setIsModalVisible(true);
  };

  // Calculate live preview in modal
  const calculateModalPreview = () => {
    const values = form.getFieldsValue();
    const calculated = calculateRowMetrics(values);
    setModalPreview(calculated);
  };

  // Submit Modal
  const handleModalSubmit = async () => {
    try {
      const values = await form.validateFields();
      const mObj = FINANCIAL_YEAR_MONTHS.find(m => m.monthKey === values.monthKey) || {
        code: "SEP",
        name: "September",
        defaultYear: 2026,
        monthKey: values.monthKey
      };

      const entryToSave = calculateRowMetrics({
        ...values,
        id: `fc-user-${Date.now()}`,
        year: mObj.defaultYear,
        month: mObj.code,
        monthName: `${mObj.name} ${mObj.defaultYear}`,
        monthKey: mObj.monthKey,
        department: values.department || getDepartmentForOfficer(values.salesOfficer)
      });

      await saveProductionForecast(entryToSave);
      message.success(`New forecast entry for ${entryToSave.buyer} added successfully!`);
      setIsModalVisible(false);
      await loadData();
    } catch (err) {
      console.error("Modal submit error:", err);
    }
  };

  // Reset to Baseline confirmation
  const handleResetBaseline = async () => {
    try {
      setLoading(true);
      await resetToExcelBaseline();
      message.success("Reset successfully to ProductionPlan.xlsx baseline!");
      await loadData();
    } catch (err) {
      console.error("Reset error:", err);
      message.error("Failed to reset baseline.");
    } finally {
      setLoading(false);
    }
  };

  // ==========================================
  // DYNAMIC HANDSONTABLE COLUMN DEFINITIONS
  // ==========================================
  // Depending on activeRoleView:
  // ==========================================
  // DYNAMIC HANDSONTABLE COLUMN DEFINITIONS
  // ==========================================
  // - "factory_performance": Shows Customer Info, Actuals reference, and Factory Performance & Confirmation
  // - "marketing_actuals": Shows Customer Info, Budget targets, Actuals, Variance, and Remarks
  // - "all_editable" / "read_only": Shows full dimensions
  const columns = useMemo(() => {
    const isAll = activeRoleView === "all_editable";
    const isMkt = activeRoleView === "marketing_actuals";
    const isFact = activeRoleView === "factory_performance";
    const isRo = activeRoleView === "read_only";

    const planEditable = isAll;
    const budgetEditable = isAll;
    const actualEditable = isAll || isMkt;
    const factoryEditable = isAll || isFact;
    const notesEditable = !isRo;

    // Customer Info columns (Frozen left 4)
    const customerCols = [
      {
        data: "monthName",
        title: "Month / Year",
        type: "dropdown",
        source: FINANCIAL_YEAR_MONTHS.map(m => `${m.name} ${m.defaultYear}`),
        width: 140,
        readOnly: !planEditable,
        className: "htLeft htMiddle " + (!planEditable ? "ht-locked-cell" : "")
      },
      {
        data: "salesOfficer",
        title: "Sales Officer",
        type: "dropdown",
        source: SALES_OFFICERS.map(s => s.code),
        width: 100,
        readOnly: !planEditable,
        className: "htCenter htMiddle " + (!planEditable ? "ht-locked-cell" : "")
      },
      {
        data: "buyer",
        title: "Buyer / Customer",
        type: "text",
        width: 210,
        readOnly: !planEditable,
        className: "htLeft htMiddle " + (!planEditable ? "ht-locked-cell" : "")
      },
      {
        data: "department",
        title: "Department",
        type: "dropdown",
        source: DEPARTMENTS,
        width: 120,
        readOnly: !planEditable,
        className: "htLeft htMiddle " + (!planEditable ? "ht-locked-cell" : "")
      }
    ];

    if (isFact) {
      return [
        ...customerCols,
        // Actual Deliveries Reference
        {
          data: "actualTeu",
          title: "Actual TEU",
          type: "numeric",
          numericFormat: { pattern: "0,0.00" },
          width: 100,
          readOnly: true,
          className: "htRight htMiddle ht-locked-cell"
        },
        {
          data: "actualTurnover",
          title: "Actual TO (LKR)",
          type: "numeric",
          numericFormat: { pattern: "0,0" },
          width: 130,
          readOnly: true,
          className: "htRight htMiddle ht-locked-cell"
        },
        // Factory Performance (Editable)
        {
          data: "factoryTeu",
          title: "Capable TEU",
          type: "numeric",
          numericFormat: { pattern: "0,0.00" },
          width: 110,
          readOnly: !factoryEditable,
          className: "htRight htMiddle " + (!factoryEditable ? "ht-locked-cell" : "ht-factory-editable")
        },
        {
          data: "factoryTurnover",
          title: "Factory TO (Ratio)",
          readOnly: true,
          renderer: (instance, td, row, col, prop, value) => {
            const val = parseFloat(value) || 0;
            td.className = "htRight htMiddle ht-locked-cell";
            td.innerText = formatCurrency(val);
            return td;
          },
          width: 135
        },
        {
          data: "factoryContribution",
          title: "Factory Contri",
          readOnly: true,
          renderer: (instance, td, row, col, prop, value) => {
            const val = parseFloat(value) || 0;
            td.className = "htRight htMiddle ht-locked-cell";
            td.innerText = formatCurrency(val);
            return td;
          },
          width: 135
        },
        {
          data: "factoryConfirmed",
          title: "Confirmed",
          type: "checkbox",
          width: 95,
          readOnly: !factoryEditable,
          className: "htCenter htMiddle " + (!factoryEditable ? "ht-locked-cell" : "")
        },
        {
          data: "notes",
          title: "Notes / Remarks",
          type: "text",
          width: 220,
          readOnly: !notesEditable,
          className: "htLeft htMiddle " + (!notesEditable ? "ht-locked-cell" : "")
        }
      ];
    }

    if (isMkt) {
      return [
        ...customerCols,
        // Budget targets
        {
          data: "budgetTeu",
          title: "TEU Qty",
          type: "numeric",
          numericFormat: { pattern: "0,0.00" },
          width: 90,
          readOnly: true,
          className: "htRight htMiddle ht-locked-cell"
        },
        {
          data: "budgetTurnover",
          title: "TO-FOB (LKR)",
          type: "numeric",
          numericFormat: { pattern: "0,0" },
          width: 130,
          readOnly: true,
          className: "htRight htMiddle ht-locked-cell"
        },
        {
          data: "budgetContribution",
          title: "Total Contri",
          type: "numeric",
          numericFormat: { pattern: "0,0" },
          width: 120,
          readOnly: true,
          className: "htRight htMiddle ht-locked-cell"
        },
        {
          data: "budgetMargin",
          title: "Margin %",
          readOnly: true,
          renderer: (instance, td, row, col, prop, value) => {
            td.className = "htRight htMiddle ht-locked-cell";
            td.innerText = formatPercentage(value);
            return td;
          },
          width: 90
        },
        // Actuals
        {
          data: "actualTeu",
          title: "TEU Qty",
          type: "numeric",
          numericFormat: { pattern: "0,0.00" },
          width: 90,
          readOnly: !actualEditable,
          className: "htRight htMiddle " + (!actualEditable ? "ht-locked-cell" : "ht-actual-editable")
        },
        {
          data: "actualTurnover",
          title: "TO-FOB (LKR)",
          type: "numeric",
          numericFormat: { pattern: "0,0" },
          width: 130,
          readOnly: !actualEditable,
          className: "htRight htMiddle " + (!actualEditable ? "ht-locked-cell" : "ht-actual-editable")
        },
        {
          data: "actualContribution",
          title: "Total Contri",
          type: "numeric",
          numericFormat: { pattern: "0,0" },
          width: 120,
          readOnly: !actualEditable,
          className: "htRight htMiddle " + (!actualEditable ? "ht-locked-cell" : "ht-actual-editable")
        },
        {
          data: "actualMargin",
          title: "Margin %",
          readOnly: true,
          renderer: (instance, td, row, col, prop, value) => {
            td.className = "htRight htMiddle ht-locked-cell";
            td.innerText = formatPercentage(value);
            return td;
          },
          width: 90
        },
        // Variance
        {
          data: "varianceTeu",
          title: "Diff TEU",
          readOnly: true,
          renderer: (instance, td, row, col, prop, value) => {
            const val = parseFloat(value) || 0;
            td.className = "htRight htMiddle ht-locked-cell " + (val >= 0 ? "ht-num-positive" : "ht-num-negative");
            td.innerText = (val > 0 ? "+" : "") + val.toFixed(2);
            return td;
          },
          width: 90
        },
        {
          data: "varianceTurnover",
          title: "Diff TO-FOB",
          readOnly: true,
          renderer: (instance, td, row, col, prop, value) => {
            const val = parseFloat(value) || 0;
            td.className = "htRight htMiddle ht-locked-cell " + (val >= 0 ? "ht-num-positive" : "ht-num-negative");
            td.innerText = (val > 0 ? "+" : "") + formatCurrency(val);
            return td;
          },
          width: 120
        },
        {
          data: "achievementRate",
          title: "% Achieved",
          readOnly: true,
          renderer: (instance, td, row, col, prop, value) => {
            const val = parseFloat(value) || 0;
            td.className = "htRight htMiddle ht-locked-cell " + (val >= 100 ? "ht-num-positive" : (val > 0 ? "ht-num-neutral" : "ht-num-negative"));
            td.innerText = val + "%";
            return td;
          },
          width: 100
        },
        {
          data: "status",
          title: "Status",
          readOnly: true,
          renderer: (instance, td, row, col, prop, value) => {
            const val = String(value || "").toLowerCase();
            td.className = "htCenter htMiddle ht-locked-cell";
            if (val === "met") {
              td.innerHTML = `<span style="background-color:#dcfce7;color:#15803d;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-block;">✓ MET</span>`;
            } else if (val === "new") {
              td.innerHTML = `<span style="background-color:#dbeafe;color:#1d4ed8;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-block;">★ NEW</span>`;
            } else if (val === "variance") {
              td.innerHTML = `<span style="background-color:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-block;">⚠ VARIANCE</span>`;
            } else {
              td.innerHTML = `<span style="background-color:#f1f5f9;color:#64748b;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;display:inline-block;">PENDING</span>`;
            }
            return td;
          },
          width: 110
        },
        {
          data: "notes",
          title: "Notes / Remarks",
          type: "text",
          width: 220,
          readOnly: !notesEditable,
          className: "htLeft htMiddle " + (!notesEditable ? "ht-locked-cell" : "")
        }
      ];
    }

    // ALL EDITABLE / FULL MANAGEMENT / READ-ONLY
    return [
      ...customerCols,
      {
        data: "budgetTeu",
        title: "TEU Qty",
        type: "numeric",
        numericFormat: { pattern: "0,0.00" },
        width: 90,
        readOnly: !budgetEditable,
        className: "htRight htMiddle " + (!budgetEditable ? "ht-locked-cell" : "")
      },
      {
        data: "budgetTurnover",
        title: "TO-FOB (LKR)",
        type: "numeric",
        numericFormat: { pattern: "0,0" },
        width: 130,
        readOnly: !budgetEditable,
        className: "htRight htMiddle " + (!budgetEditable ? "ht-locked-cell" : "")
      },
      {
        data: "budgetContribution",
        title: "Total Contri",
        type: "numeric",
        numericFormat: { pattern: "0,0" },
        width: 120,
        readOnly: !budgetEditable,
        className: "htRight htMiddle " + (!budgetEditable ? "ht-locked-cell" : "")
      },
      {
        data: "budgetMargin",
        title: "Margin %",
        readOnly: true,
        renderer: (instance, td, row, col, prop, value) => {
          td.className = "htRight htMiddle ht-locked-cell";
          td.innerText = formatPercentage(value);
          return td;
        },
        width: 90
      },
      {
        data: "actualTeu",
        title: "TEU Qty",
        type: "numeric",
        numericFormat: { pattern: "0,0.00" },
        width: 90,
        readOnly: !actualEditable,
        className: "htRight htMiddle " + (!actualEditable ? "ht-locked-cell" : "ht-actual-editable")
      },
      {
        data: "actualTurnover",
        title: "TO-FOB (LKR)",
        type: "numeric",
        numericFormat: { pattern: "0,0" },
        width: 130,
        readOnly: !actualEditable,
        className: "htRight htMiddle " + (!actualEditable ? "ht-locked-cell" : "ht-actual-editable")
      },
      {
        data: "actualContribution",
        title: "Total Contri",
        type: "numeric",
        numericFormat: { pattern: "0,0" },
        width: 120,
        readOnly: !actualEditable,
        className: "htRight htMiddle " + (!actualEditable ? "ht-locked-cell" : "ht-actual-editable")
      },
      {
        data: "actualMargin",
        title: "Margin %",
        readOnly: true,
        renderer: (instance, td, row, col, prop, value) => {
          td.className = "htRight htMiddle ht-locked-cell";
          td.innerText = formatPercentage(value);
          return td;
        },
        width: 90
      },
      {
        data: "varianceTeu",
        title: "Diff TEU",
        readOnly: true,
        renderer: (instance, td, row, col, prop, value) => {
          const val = parseFloat(value) || 0;
          td.className = "htRight htMiddle ht-locked-cell " + (val >= 0 ? "ht-num-positive" : "ht-num-negative");
          td.innerText = (val > 0 ? "+" : "") + val.toFixed(2);
          return td;
        },
        width: 90
      },
      {
        data: "varianceTurnover",
        title: "Diff TO-FOB",
        readOnly: true,
        renderer: (instance, td, row, col, prop, value) => {
          const val = parseFloat(value) || 0;
          td.className = "htRight htMiddle ht-locked-cell " + (val >= 0 ? "ht-num-positive" : "ht-num-negative");
          td.innerText = (val > 0 ? "+" : "") + formatCurrency(val);
          return td;
        },
        width: 120
      },
      {
        data: "achievementRate",
        title: "% Achieved",
        readOnly: true,
        renderer: (instance, td, row, col, prop, value) => {
          const val = parseFloat(value) || 0;
          td.className = "htRight htMiddle ht-locked-cell " + (val >= 100 ? "ht-num-positive" : (val > 0 ? "ht-num-neutral" : "ht-num-negative"));
          td.innerText = val + "%";
          return td;
        },
        width: 100
      },
      {
        data: "status",
        title: "Status",
        readOnly: true,
        renderer: (instance, td, row, col, prop, value) => {
          const val = String(value || "").toLowerCase();
          td.className = "htCenter htMiddle ht-locked-cell";
          if (val === "met") {
            td.innerHTML = `<span style="background-color:#dcfce7;color:#15803d;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-block;">✓ MET</span>`;
          } else if (val === "new") {
            td.innerHTML = `<span style="background-color:#dbeafe;color:#1d4ed8;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-block;">★ NEW</span>`;
          } else if (val === "variance") {
            td.innerHTML = `<span style="background-color:#fee2e2;color:#b91c1c;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:700;display:inline-block;">⚠ VARIANCE</span>`;
          } else {
            td.innerHTML = `<span style="background-color:#f1f5f9;color:#64748b;padding:3px 8px;border-radius:12px;font-size:11px;font-weight:600;display:inline-block;">PENDING</span>`;
          }
          return td;
        },
        width: 110
      },
      {
        data: "factoryTeu",
        title: "Capable TEU",
        type: "numeric",
        numericFormat: { pattern: "0,0.00" },
        width: 105,
        readOnly: !factoryEditable,
        className: "htRight htMiddle " + (!factoryEditable ? "ht-locked-cell" : "ht-factory-editable")
      },
      {
        data: "factoryTurnover",
        title: "Factory TO (LKR)",
        readOnly: true,
        renderer: (instance, td, row, col, prop, value) => {
          const val = parseFloat(value) || 0;
          td.className = "htRight htMiddle ht-locked-cell";
          td.innerText = formatCurrency(val);
          return td;
        },
        width: 130
      },
      {
        data: "factoryConfirmed",
        title: "Confirmed",
        type: "checkbox",
        width: 90,
        readOnly: !factoryEditable,
        className: "htCenter htMiddle " + (!factoryEditable ? "ht-locked-cell" : "")
      },
      {
        data: "notes",
        title: "Notes / Remarks",
        type: "text",
        width: 220,
        readOnly: !notesEditable,
        className: "htLeft htMiddle " + (!notesEditable ? "ht-locked-cell" : "")
      }
    ];
  }, [activeRoleView]);

  // Grouped Nested Headers per view
  const nestedHeaders = useMemo(() => {
    if (activeRoleView === "factory_performance") {
      return [
        [
          { label: "Plan & Customer Info (Frozen)", colspan: 4 },
          { label: "Actual Deliveries Reference", colspan: 2, className: "ht-header-actual" },
          { label: "Factory Performance & Confirmation", colspan: 5, className: "ht-header-factory" }
        ],
        [
          "Month / Year", "Officer", "Buyer / Customer", "Department",
          "Actual TEU", "Actual TO (LKR)",
          "Capable TEU", "Factory TO (Ratio)", "Factory Contri", "Confirmed", "Notes / Remarks"
        ]
      ];
    }

    if (activeRoleView === "marketing_actuals") {
      return [
        [
          { label: "Plan & Customer Info (Frozen)", colspan: 4 },
          { label: "Initial Budget Targets", colspan: 4, className: "ht-header-budget" },
          { label: "Actual Performance", colspan: 4, className: "ht-header-actual" },
          { label: "Variance & Target Achievement", colspan: 4, className: "ht-header-variance" },
          { label: "Remarks", colspan: 1 }
        ],
        [
          "Month / Year", "Officer", "Buyer / Customer", "Department",
          "TEU Qty", "TO-FOB (LKR)", "Total Contri", "Margin %",
          "TEU Qty", "TO-FOB (LKR)", "Total Contri", "Margin %",
          "Diff TEU", "Diff TO-FOB", "% Achieved", "Status",
          "Notes / Remarks"
        ]
      ];
    }

    return [
      [
        { label: "Plan & Customer Info (Frozen)", colspan: 4 },
        { label: "Initial Budget Targets", colspan: 4, className: "ht-header-budget" },
        { label: "Actual Performance", colspan: 4, className: "ht-header-actual" },
        { label: "Variance & Target Achievement", colspan: 4, className: "ht-header-variance" },
        { label: "Factory Performance & Confirmation", colspan: 4, className: "ht-header-factory" }
      ],
      [
        "Month / Year", "Officer", "Buyer / Customer", "Department",
        "TEU Qty", "TO-FOB (LKR)", "Total Contri", "Margin %",
        "TEU Qty", "TO-FOB (LKR)", "Total Contri", "Margin %",
        "Diff TEU", "Diff TO-FOB", "% Achieved", "Status",
        "Capable TEU", "Factory TO (Ratio)", "Confirmed", "Notes / Remarks"
      ]
    ];
  }, [activeRoleView]);

  return (
    <div style={{ padding: "16px 24px", minHeight: "100vh", backgroundColor: "#f8fafc" }}>
      {/* Top Header & Page Navigation */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18, flexWrap: "wrap", gap: 12 }}>
        <div>
          <Space orientation="horizontal" size="middle" align="center">
            <div style={{ 
              width: 44, 
              height: 44, 
              borderRadius: 12, 
              background: "linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%)", 
              display: "flex", 
              alignItems: "center", 
              justifyContent: "center", 
              color: "white", 
              fontSize: 22,
              boxShadow: "0 4px 12px rgba(59, 130, 246, 0.3)"
            }}>
              <FundProjectionScreenOutlined />
            </div>
            <div>
              <Title level={3} style={{ margin: 0, fontWeight: 700, color: "#0f172a" }}>
                {pageTitle || (activeRoleView === "factory_performance" ? "🏭 Production Confirmation & Factory Performance" : (activeRoleView === "marketing_actuals" ? "📈 Production Forecast & Actuals (Marketing View)" : (activeRoleView === "read_only" ? "👁️ Production Forecast (Read-Only View)" : "👑 Production Plan & Forecast (Full Management)")))}
              </Title>
              <Text type="secondary" style={{ fontSize: 13 }}>
                {pageSubtitle || (activeRoleView === "factory_performance" ? "Factory team operations view for evaluating TEU capabilities, turnover ratios, and confirming production" : (activeRoleView === "marketing_actuals" ? "Marketing department view for entering and tracking actual deliveries against budget targets" : (activeRoleView === "read_only" ? "Auditor and executive summary view with protected, locked dimensions" : "Multi-month Budget vs Actual tracking, ratio-based factory performance, and master controls")))}
              </Text>
            </div>
          </Space>
        </div>

        <Space size="middle" wrap align="center">
          {autoSaveStatus === "saving" && (
            <Tag icon={<SyncOutlined spin />} color="processing" style={{ borderRadius: 8, padding: "4px 10px", fontWeight: 600 }}>
              Auto-saving...
            </Tag>
          )}

          {autoSaveStatus === "saved" && (
            <Tag icon={<CheckCircleOutlined />} color="success" style={{ borderRadius: 8, padding: "4px 10px", fontWeight: 600 }}>
              Auto-saved ({lastSavedTime})
            </Tag>
          )}

          {autoSaveStatus === "error" && (
            <Tag icon={<WarningOutlined />} color="error" style={{ borderRadius: 8, padding: "4px 10px", fontWeight: 600 }}>
              Auto-save warning • Click Save All
            </Tag>
          )}

          {activeRoleView !== "read_only" && (
            <Button
              type="primary"
              icon={<SaveOutlined />}
              loading={saving}
              onClick={handleSaveAll}
              style={{ backgroundColor: hasUnsavedChanges ? "#16a34a" : "#2563eb", borderColor: hasUnsavedChanges ? "#16a34a" : "#2563eb", fontWeight: 600, height: 38 }}
            >
              Save All Changes
            </Button>
          )}

          <Button
            type="primary"
            icon={<FilePptOutlined />}
            loading={exportingPpt}
            onClick={handleExportPowerPoint}
            style={{ backgroundColor: "#d97706", borderColor: "#d97706", fontWeight: 600, height: 38 }}
          >
            Export PowerPoint
          </Button>

          {(isProdAdmin || activeRoleView === "marketing_actuals") && (
            <Button
              icon={<PlusOutlined />}
              onClick={handleOpenAddModal}
              style={{ fontWeight: 600, height: 38 }}
            >
              Add New Entry
            </Button>
          )}

          {(isProdAdmin || activeRoleView === "marketing_actuals") && (
            <Button
              icon={<CloudUploadOutlined />}
              onClick={() => setIsUploadModalVisible(true)}
              style={{ fontWeight: 600, height: 38 }}
            >
              Upload Excel
            </Button>
          )}

          <Button
            icon={<FileExcelOutlined />}
            onClick={handleDownloadTemplate}
            style={{ height: 38 }}
          >
            Download Template
          </Button>

          <Button
            icon={<DownloadOutlined />}
            onClick={() => exportForecastToExcel(filteredData, `Production_Forecast_${activePeriodLabel.replace(/[^a-zA-Z0-9_-]/g, "_")}.xlsx`)}
            style={{ height: 38 }}
          >
            Export Grid
          </Button>

          <Button
            type="dashed"
            icon={<DashboardOutlined />}
            onClick={() => navigate("/production-forecast/dashboard")}
            style={{ borderColor: "#6366f1", color: "#4f46e5", fontWeight: 600, height: 38 }}
          >
            Dashboard
          </Button>

          {isProdAdmin && (
            <Popconfirm
              title="Reset to Excel Baseline?"
              description="Restore all standard records from ProductionPlan.xlsx baseline."
              onConfirm={handleResetBaseline}
              okText="Yes, Reset"
              cancelText="Cancel"
            >
              <Tooltip title="Reset to ProductionPlan.xlsx baseline">
                <Button icon={<ReloadOutlined />} style={{ height: 38 }} />
              </Tooltip>
            </Popconfirm>
          )}
        </Space>
      </div>


      {/* KPI Summary Cards Bar - View Tailored & Designated Scope */}
      <Row gutter={[16, 16]} style={{ marginBottom: 16 }}>
        {/* FACTORY VIEW: Focused on Actual Deliveries Reference, Factory Capability & Confirmation */}
        {activeRoleView === "factory_performance" ? (
          <>
            <Col xs={24} sm={8} md={8}>
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 12, 
                  borderLeft: "4px solid #8b5cf6", 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "white" 
                }}
              >
                <Statistic
                  title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>ACTUAL DELIVERIES REFERENCE</span>}
                  value={formatCompactCurrency(summaryMetrics.aTo)}
                  prefix={<span style={{ fontSize: 13, color: "#8b5cf6", fontWeight: 700 }}>LKR</span>}
                  suffix={<Text type="secondary" style={{ fontSize: 12 }}>({summaryMetrics.aTeu} TEUs)</Text>}
                  valueStyle={{ fontWeight: 800, color: "#581c87", fontSize: 20 }}
                />
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>Contri: {formatCompactCurrency(summaryMetrics.aCont)}</Text>
                  <Text style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600 }}>Margin: {formatPercentage(summaryMetrics.aMargin)}</Text>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={8} md={8}>
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 12, 
                  borderLeft: "4px solid #0f766e", 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "white" 
                }}
              >
                <Statistic
                  title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>FACTORY PERFORMANCE (RATIO)</span>}
                  value={formatCompactCurrency(summaryMetrics.fTo)}
                  prefix={<span style={{ fontSize: 13, color: "#0f766e", fontWeight: 700 }}>LKR</span>}
                  suffix={<Text type="secondary" style={{ fontSize: 12 }}>({summaryMetrics.fTeu} Capable TEU)</Text>}
                  valueStyle={{ fontWeight: 800, color: "#0f766e", fontSize: 20 }}
                />
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>Contri: {formatCompactCurrency(summaryMetrics.fCont)}</Text>
                  <Text style={{ fontSize: 11, color: "#0f766e", fontWeight: 600 }}>
                    {summaryMetrics.aTeu > 0 ? `${Math.round((summaryMetrics.fTeu / summaryMetrics.aTeu) * 100)}% of Actual` : "-"}
                  </Text>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={8} md={8}>
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 12, 
                  borderLeft: `4px solid ${summaryMetrics.confirmedCount === summaryMetrics.totalRows && summaryMetrics.totalRows > 0 ? "#10b981" : "#0d9488"}`, 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "white" 
                }}
              >
                <Statistic
                  title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>FACTORY PRODUCTION CONFIRMATION</span>}
                  value={`${summaryMetrics.confirmedCount} / ${summaryMetrics.totalRows}`}
                  prefix={<CheckCircleOutlined style={{ color: summaryMetrics.confirmedCount === summaryMetrics.totalRows && summaryMetrics.totalRows > 0 ? "#10b981" : "#0d9488" }} />}
                  suffix={<Text type="secondary" style={{ fontSize: 12 }}>({summaryMetrics.totalRows > 0 ? Math.round((summaryMetrics.confirmedCount / summaryMetrics.totalRows) * 100) : 0}% Confirmed)</Text>}
                  valueStyle={{ fontWeight: 800, color: "#0f766e", fontSize: 20 }}
                />
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#0f766e", fontWeight: 600 }}>
                    Confirmed TEU: {summaryMetrics.confirmedTeu} TEUs
                  </Text>
                  <Tag color={summaryMetrics.confirmedCount === summaryMetrics.totalRows && summaryMetrics.totalRows > 0 ? "success" : "processing"} style={{ margin: 0, fontSize: 10, padding: "0 6px" }}>
                    {summaryMetrics.confirmedCount === summaryMetrics.totalRows && summaryMetrics.totalRows > 0 ? "All Confirmed" : `${summaryMetrics.totalRows - summaryMetrics.confirmedCount} Pending`}
                  </Tag>
                </div>
              </Card>
            </Col>
          </>
        ) : activeRoleView === "marketing_actuals" ? (
          /* MARKETING VIEW: Focused on Budget, Actuals, and Variance Achievement */
          <>
            <Col xs={24} sm={8} md={8}>
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 12, 
                  borderLeft: "4px solid #3b82f6", 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "white" 
                }}
              >
                <Statistic
                  title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>BUDGET TARGETS</span>}
                  value={formatCompactCurrency(summaryMetrics.bTo)}
                  prefix={<span style={{ fontSize: 13, color: "#3b82f6", fontWeight: 700 }}>LKR</span>}
                  suffix={<Text type="secondary" style={{ fontSize: 12 }}>({summaryMetrics.bTeu} TEUs)</Text>}
                  valueStyle={{ fontWeight: 800, color: "#1e3a8a", fontSize: 20 }}
                />
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>Contri: {formatCompactCurrency(summaryMetrics.bCont)}</Text>
                  <Text style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>Margin: {formatPercentage(summaryMetrics.bMargin)}</Text>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={8} md={8}>
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 12, 
                  borderLeft: "4px solid #8b5cf6", 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "white" 
                }}
              >
                <Statistic
                  title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>ACTUAL PERFORMANCE</span>}
                  value={formatCompactCurrency(summaryMetrics.aTo)}
                  prefix={<span style={{ fontSize: 13, color: "#8b5cf6", fontWeight: 700 }}>LKR</span>}
                  suffix={<Text type="secondary" style={{ fontSize: 12 }}>({summaryMetrics.aTeu} TEUs)</Text>}
                  valueStyle={{ fontWeight: 800, color: "#581c87", fontSize: 20 }}
                />
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>Contri: {formatCompactCurrency(summaryMetrics.aCont)}</Text>
                  <Text style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600 }}>Margin: {formatPercentage(summaryMetrics.aMargin)}</Text>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={8} md={8}>
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 12, 
                  borderLeft: `4px solid ${summaryMetrics.vTo >= 0 ? "#10b981" : "#ef4444"}`, 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "white" 
                }}
              >
                <Statistic
                  title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>OVERALL VARIANCE & ACHIEVEMENT</span>}
                  value={summaryMetrics.achRate}
                  suffix="%"
                  prefix={summaryMetrics.vTo >= 0 ? <ArrowUpOutlined style={{ color: "#10b981" }} /> : <ArrowDownOutlined style={{ color: "#ef4444" }} />}
                  valueStyle={{ fontWeight: 800, color: summaryMetrics.vTo >= 0 ? "#065f46" : "#991b1b", fontSize: 20 }}
                />
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: summaryMetrics.vTo >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                    {summaryMetrics.vTo >= 0 ? "+" : ""}{formatCompactCurrency(summaryMetrics.vTo)} LKR
                  </Text>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Tag color="success" style={{ margin: 0, fontSize: 10, padding: "0 4px" }}>{summaryMetrics.metCount} Met</Tag>
                    <Tag color="error" style={{ margin: 0, fontSize: 10, padding: "0 4px" }}>{summaryMetrics.varCount} Var</Tag>
                  </div>
                </div>
              </Card>
            </Col>
          </>
        ) : (
          /* FULL MANAGEMENT / READ-ONLY VIEW: All 4 Dimension Cards */
          <>
            <Col xs={24} sm={12} md={6}>
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 12, 
                  borderLeft: "4px solid #3b82f6", 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "white" 
                }}
              >
                <Statistic
                  title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>BUDGET TURNOVER & TEU</span>}
                  value={formatCompactCurrency(summaryMetrics.bTo)}
                  prefix={<span style={{ fontSize: 13, color: "#3b82f6", fontWeight: 700 }}>LKR</span>}
                  suffix={<Text type="secondary" style={{ fontSize: 12 }}>({summaryMetrics.bTeu} TEUs)</Text>}
                  valueStyle={{ fontWeight: 800, color: "#1e3a8a", fontSize: 20 }}
                />
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>Contri: {formatCompactCurrency(summaryMetrics.bCont)}</Text>
                  <Text style={{ fontSize: 11, color: "#3b82f6", fontWeight: 600 }}>Margin: {formatPercentage(summaryMetrics.bMargin)}</Text>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 12, 
                  borderLeft: "4px solid #8b5cf6", 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "white" 
                }}
              >
                <Statistic
                  title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>ACTUAL TURNOVER & TEU</span>}
                  value={formatCompactCurrency(summaryMetrics.aTo)}
                  prefix={<span style={{ fontSize: 13, color: "#8b5cf6", fontWeight: 700 }}>LKR</span>}
                  suffix={<Text type="secondary" style={{ fontSize: 12 }}>({summaryMetrics.aTeu} TEUs)</Text>}
                  valueStyle={{ fontWeight: 800, color: "#581c87", fontSize: 20 }}
                />
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>Contri: {formatCompactCurrency(summaryMetrics.aCont)}</Text>
                  <Text style={{ fontSize: 11, color: "#8b5cf6", fontWeight: 600 }}>Margin: {formatPercentage(summaryMetrics.aMargin)}</Text>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 12, 
                  borderLeft: "4px solid #0f766e", 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "white" 
                }}
              >
                <Statistic
                  title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>FACTORY PERFORMANCE (RATIO)</span>}
                  value={formatCompactCurrency(summaryMetrics.fTo)}
                  prefix={<span style={{ fontSize: 13, color: "#0f766e", fontWeight: 700 }}>LKR</span>}
                  suffix={<Text type="secondary" style={{ fontSize: 12 }}>({summaryMetrics.fTeu} Capable TEU)</Text>}
                  valueStyle={{ fontWeight: 800, color: "#0f766e", fontSize: 20 }}
                />
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: "#64748b" }}>Contri: {formatCompactCurrency(summaryMetrics.fCont)}</Text>
                  <Text style={{ fontSize: 11, color: "#0f766e", fontWeight: 600 }}>
                    {summaryMetrics.aTeu > 0 ? `${Math.round((summaryMetrics.fTeu / summaryMetrics.aTeu) * 100)}% of Act` : "-"}
                  </Text>
                </div>
              </Card>
            </Col>

            <Col xs={24} sm={12} md={6}>
              <Card 
                size="small" 
                style={{ 
                  borderRadius: 12, 
                  borderLeft: `4px solid ${summaryMetrics.vTo >= 0 ? "#10b981" : "#ef4444"}`, 
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  background: "white" 
                }}
              >
                <Statistic
                  title={<span style={{ color: "#64748b", fontWeight: 600, fontSize: 12 }}>OVERALL VARIANCE & ACHIEVEMENT</span>}
                  value={summaryMetrics.achRate}
                  suffix="%"
                  prefix={summaryMetrics.vTo >= 0 ? <ArrowUpOutlined style={{ color: "#10b981" }} /> : <ArrowDownOutlined style={{ color: "#ef4444" }} />}
                  valueStyle={{ fontWeight: 800, color: summaryMetrics.vTo >= 0 ? "#065f46" : "#991b1b", fontSize: 20 }}
                />
                <div style={{ marginTop: 4, display: "flex", justifyContent: "space-between" }}>
                  <Text style={{ fontSize: 11, color: summaryMetrics.vTo >= 0 ? "#10b981" : "#ef4444", fontWeight: 600 }}>
                    {summaryMetrics.vTo >= 0 ? "+" : ""}{formatCompactCurrency(summaryMetrics.vTo)} LKR
                  </Text>
                  <div style={{ display: "flex", gap: 4 }}>
                    <Tag color="success" style={{ margin: 0, fontSize: 10, padding: "0 4px" }}>{summaryMetrics.metCount} Met</Tag>
                    <Tag color="error" style={{ margin: 0, fontSize: 10, padding: "0 4px" }}>{summaryMetrics.varCount} Var</Tag>
                  </div>
                </div>
              </Card>
            </Col>
          </>
        )}
      </Row>

      {/* Interactive Time Period & Facet Filters Bar */}
      <Card 
        style={{ 
          marginBottom: 16, 
          borderRadius: 14, 
          boxShadow: "0 2px 8px rgba(0,0,0,0.03)", 
          border: "1px solid #e2e8f0" 
        }}
        styles={{ body: { padding: "14px 20px" } }}
      >
        <Row gutter={[16, 12]} align="middle" justify="space-between">
          <Col xs={24} xl={15}>
            <Space size="middle" wrap align="center">
              <div>
                <Text strong style={{ color: "#475569", marginRight: 8, fontSize: 13 }}>
                  <CalendarOutlined style={{ marginRight: 4, color: "#3b82f6" }} /> Time Period:
                </Text>
                <Radio.Group 
                  value={viewMode} 
                  onChange={(e) => setViewMode(e.target.value)} 
                  optionType="button"
                  buttonStyle="solid"
                  size="small"
                >
                  <Radio.Button value="single">Single Month</Radio.Button>
                  <Radio.Button value="from_to">From - To Range</Radio.Button>
                  <Radio.Button value="rolling">Rolling 4M</Radio.Button>
                  <Radio.Button value="custom">Multi-Select</Radio.Button>
                  <Radio.Button value="all">Full Year (12M)</Radio.Button>
                </Radio.Group>
              </div>

              {/* Single Month Picker */}
              {viewMode === "single" && (
                <Select
                  value={singleMonth}
                  onChange={(val) => setSingleMonth(val)}
                  style={{ width: 170 }}
                  size="middle"
                >
                  {FINANCIAL_YEAR_MONTHS.map(m => (
                    <Option key={m.monthKey} value={m.monthKey}>
                      {m.name} {m.defaultYear} {m.monthKey === currentMonthKey ? "(Current)" : ""}
                    </Option>
                  ))}
                </Select>
              )}

              {/* From - To Range Filter */}
              {viewMode === "from_to" && (
                <Space size="small" align="center">
                  <Select
                    value={fromMonth}
                    onChange={(val) => setFromMonth(val)}
                    style={{ width: 155 }}
                    size="middle"
                    placeholder="From Month"
                  >
                    {FINANCIAL_YEAR_MONTHS.map(m => (
                      <Option key={m.monthKey} value={m.monthKey}>{m.name} {m.defaultYear}</Option>
                    ))}
                  </Select>
                  <SwapRightOutlined style={{ color: "#64748b" }} />
                  <Select
                    value={toMonth}
                    onChange={(val) => setToMonth(val)}
                    style={{ width: 155 }}
                    size="middle"
                    placeholder="To Month"
                  >
                    {FINANCIAL_YEAR_MONTHS.map(m => (
                      <Option key={m.monthKey} value={m.monthKey}>{m.name} {m.defaultYear}</Option>
                    ))}
                  </Select>
                </Space>
              )}

              {/* Rolling 4 Months Indicator */}
              {viewMode === "rolling" && (
                <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                  {default4Months.map(m => (
                    <Tag key={m.monthKey} color={m.monthKey === currentMonthKey ? "blue" : "default"} style={{ borderRadius: 6, fontWeight: 600 }}>
                      {m.month} {m.year}
                    </Tag>
                  ))}
                </div>
              )}

              {/* Custom Multi-select */}
              {viewMode === "custom" && (
                <Select
                  mode="multiple"
                  placeholder="Select Months"
                  value={selectedMonths}
                  onChange={(vals) => setSelectedMonths(vals)}
                  style={{ minWidth: 260, maxWidth: 360 }}
                  maxTagCount="responsive"
                  size="middle"
                >
                  {FINANCIAL_YEAR_MONTHS.map(m => (
                    <Option key={m.monthKey} value={m.monthKey}>{m.name} {m.defaultYear}</Option>
                  ))}
                </Select>
              )}
            </Space>
          </Col>

          <Col xs={24} xl={9}>
            <Space size="middle" wrap style={{ width: "100%", justifyContent: "flex-end" }}>
              <Select
                value={selectedOfficer}
                onChange={setSelectedOfficer}
                style={{ width: 120 }}
                placeholder="Sales Officer"
                size="middle"
              >
                <Option value="all">All Officers</Option>
                {SALES_OFFICERS.map(s => (
                  <Option key={s.code} value={s.code}>{s.code}</Option>
                ))}
              </Select>

              <Select
                value={selectedDepartment}
                onChange={setSelectedDepartment}
                style={{ width: 125 }}
                placeholder="Department"
                size="middle"
              >
                <Option value="all">All Depts</Option>
                {DEPARTMENTS.map(d => (
                  <Option key={d} value={d}>{d}</Option>
                ))}
              </Select>

              <Select
                value={selectedStatus}
                onChange={setSelectedStatus}
                style={{ width: 115 }}
                placeholder="Status"
                size="middle"
              >
                <Option value="all">All Status</Option>
                <Option value="met">Met Only</Option>
                <Option value="new">New Only</Option>
                <Option value="variance">Variance</Option>
              </Select>

              <Input
                placeholder="Search Buyer / Month / Year..."
                prefix={<SearchOutlined style={{ color: "#94a3b8" }} />}
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                style={{ width: 200 }}
                allowClear
              />
            </Space>
          </Col>
        </Row>
      </Card>

      {/* Handsontable Main Grid Container */}
      <div className="hot-container" style={{ minHeight: 480, background: "#ffffff", borderRadius: 12, border: "1px solid #e2e8f0", overflow: "hidden" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc", flexWrap: "wrap", gap: 10 }}>
          <Space size="middle" wrap align="center">
            <Space size="small">
              <TableOutlined style={{ color: "#3b82f6" }} />
              <Text strong style={{ fontSize: 13, color: "#334155" }}>
                {activePeriodLabel} • {filteredData.length} records
              </Text>
            </Space>

            {/* Select All to Confirm for Production Control - STRICTLY FACTORY VIEW ONLY */}
            {activeRoleView === "factory_performance" && (
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#f0fdfa", padding: "3px 10px", borderRadius: 8, border: "1px solid #ccfbf1" }}>
                <Checkbox
                  indeterminate={someConfirmed}
                  checked={isAllConfirmed}
                  onChange={(e) => handleToggleConfirmAllProduction(e.target.checked)}
                  style={{ fontWeight: 600, color: "#0f766e" }}
                >
                  Select All to Confirm for Production ({filteredData.filter(r => !!r.factoryConfirmed).length}/{filteredData.length} Confirmed)
                </Checkbox>

                <Button
                  size="small"
                  type={isAllConfirmed ? "default" : "primary"}
                  icon={<CheckCircleOutlined />}
                  onClick={() => handleToggleConfirmAllProduction(!isAllConfirmed)}
                  style={{
                    backgroundColor: isAllConfirmed ? "#f1f5f9" : "#0f766e",
                    borderColor: isAllConfirmed ? "#cbd5e1" : "#0f766e",
                    color: isAllConfirmed ? "#475569" : "#ffffff",
                    fontWeight: 600,
                    fontSize: 11,
                    height: 24,
                    padding: "0 8px"
                  }}
                >
                  {isAllConfirmed ? "Unconfirm All" : "Confirm All Visible"}
                </Button>
              </div>
            )}

            <Tag color="blue" style={{ borderRadius: 6, fontSize: 11 }}>
              First 4 columns (Plan & Customer Info) are frozen • Scroll horizontally for Budget, Actuals & Factory
            </Tag>
          </Space>

          <Space size="small">
            {isProdAdmin && (
              <>
                <Button 
                  size="small" 
                  type="dashed" 
                  icon={<PlusOutlined />} 
                  onClick={handleAddInlineRow}
                  style={{ fontWeight: 600, fontSize: 12 }}
                >
                  Add Row to Active Month
                </Button>
                <Button
                  size="small"
                  danger
                  icon={<DeleteOutlined />}
                  onClick={() => setIsDeleteModalVisible(true)}
                  style={{ fontWeight: 600, fontSize: 12 }}
                >
                  Delete Entries
                </Button>
              </>
            )}
          </Space>
        </div>

        {/* Handsontable with fixedColumnsLeft: 4 for freezing Plan & Customer Info */}
        <HotTable
          ref={hotTableRef}
          data={filteredData}
          columns={columns}
          nestedHeaders={nestedHeaders}
          colHeaders={true}
          rowHeaders={true}
          height={540}
          width="100%"
          stretchH="none"
          fixedColumnsLeft={4}
          manualColumnResize={true}
          manualRowResize={true}
          columnSorting={true}
          contextMenu={isProdAdmin ? [
            "row_above", 
            "row_below", 
            "remove_row", 
            "---------", 
            "undo", 
            "redo", 
            "make_read_only", 
            "alignment", 
            "copy", 
            "cut"
          ] : [
            "copy",
            "undo",
            "redo",
            "alignment"
          ]}
          afterChange={handleHandsontableChange}
          afterRemoveRow={(index, amount, physicalRows) => {
            if (physicalRows && physicalRows.length > 0) {
              const removedIds = [];
              physicalRows.forEach(rowIdx => {
                const item = filteredData[rowIdx];
                if (item && item.id) {
                  removedIds.push(item.id);
                  deleteProductionForecast(item.id);
                }
              });
              setAllData(prev => prev.filter(r => !removedIds.includes(r.id)));
              message.info(`Deleted ${amount} entry/entries.`);
            }
          }}
          licenseKey="non-commercial-and-evaluation"
          renderAllRows={false}
          autoWrapRow={true}
          autoWrapCol={true}
        />
      </div>

      {/* Delete Entries Management Modal */}
      <Modal
        title={
          <Space>
            <DeleteOutlined style={{ color: "#ef4444" }} />
            <span>Manage & Delete Production Forecast Entries</span>
          </Space>
        }
        open={isDeleteModalVisible}
        onCancel={() => setIsDeleteModalVisible(false)}
        footer={[
          <Button key="close" onClick={() => setIsDeleteModalVisible(false)}>
            Done
          </Button>
        ]}
        width={780}
      >
        <div style={{ margin: "12px 0" }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            Select any entry below to permanently remove it from the forecast.
          </Text>

          <Table
            size="small"
            dataSource={filteredData}
            rowKey="id"
            pagination={{ pageSize: 8 }}
            columns={[
              { title: "Month", dataIndex: "monthName", key: "monthName", width: 130 },
              { title: "Officer", dataIndex: "salesOfficer", key: "salesOfficer", width: 80, align: "center" },
              { title: "Buyer / Customer", dataIndex: "buyer", key: "buyer" },
              { title: "Dept", dataIndex: "department", key: "department", width: 110 },
              { title: "Budget TO", dataIndex: "budgetTurnover", key: "budgetTurnover", width: 110, align: "right", render: v => formatCompactCurrency(v) },
              { title: "Actual TO", dataIndex: "actualTurnover", key: "actualTurnover", width: 110, align: "right", render: v => formatCompactCurrency(v) },
              {
                title: "Action",
                key: "action",
                align: "center",
                width: 90,
                render: (_, record) => (
                  <Popconfirm
                    title="Delete this entry?"
                    description={`Are you sure you want to delete ${record.buyer} (${record.monthName})?`}
                    onConfirm={() => handleDeleteRow(record.id, record.buyer)}
                    okText="Yes, Delete"
                    okType="danger"
                    cancelText="Cancel"
                  >
                    <Button size="small" type="text" danger icon={<DeleteOutlined />}>
                      Delete
                    </Button>
                  </Popconfirm>
                )
              }
            ]}
          />
        </div>
      </Modal>

      {/* Excel Upload / Import Modal */}
      <Modal
        title={
          <Space>
            <CloudUploadOutlined style={{ color: "#10b981" }} />
            <span>Upload / Import Production Forecast from Excel</span>
          </Space>
        }
        open={isUploadModalVisible}
        onCancel={() => {
          setIsUploadModalVisible(false);
          setParsedImportData(null);
        }}
        width={750}
        footer={[
          <Button key="close" onClick={() => setIsUploadModalVisible(false)}>
            Cancel
          </Button>,
          <Button
            key="import"
            type="primary"
            disabled={!parsedImportData || parsedImportData.rows.length === 0}
            loading={importLoading}
            onClick={handleCommitImport}
            style={{ backgroundColor: "#10b981", borderColor: "#10b981", fontWeight: 700 }}
          >
            Import {parsedImportData ? parsedImportData.rows.length : 0} Records into System
          </Button>
        ]}
      >
        <div style={{ margin: "16px 0" }}>
          <Text type="secondary" style={{ display: "block", marginBottom: 12 }}>
            Upload your filled `.xlsx` or `.xls` spreadsheet. You can use the downloaded template with in-cell dropdowns for best compatibility.
          </Text>

          <Dragger
            name="file"
            multiple={false}
            accept=".xlsx, .xls"
            beforeUpload={handleFileUpload}
            showUploadList={false}
            style={{ padding: "20px 0", background: "#f8fafc", borderRadius: 12 }}
          >
            <p className="ant-upload-drag-icon">
              <FileExcelOutlined style={{ fontSize: 40, color: "#10b981" }} />
            </p>
            <p className="ant-upload-text" style={{ fontWeight: 600 }}>Click or drag Excel spreadsheet to this area</p>
            <p className="ant-upload-hint">Supports .xlsx and .xls with standard production forecast columns</p>
          </Dragger>

          {parsedImportData && (
            <div style={{ marginTop: 20 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <Space align="center">
                  <Tag color="success" style={{ fontWeight: 700, padding: "4px 10px" }}>
                    ✓ {parsedImportData.totalParsed} Valid Records Detected
                  </Tag>
                  {parsedImportData.warnings.length > 0 && (
                    <Tag color="warning" style={{ fontWeight: 600 }}>
                      ⚠ {parsedImportData.warnings.length} Warnings
                    </Tag>
                  )}
                </Space>

                <div>
                  <Text strong style={{ marginRight: 8, fontSize: 13 }}>Import Strategy:</Text>
                  <Radio.Group 
                    value={importMode} 
                    onChange={(e) => setImportMode(e.target.value)} 
                    size="small"
                  >
                    <Radio.Button value="merge">Merge / Update Matching</Radio.Button>
                    <Radio.Button value="append">Append All</Radio.Button>
                    <Radio.Button value="replace">Replace All</Radio.Button>
                  </Radio.Group>
                </div>
              </div>

              {/* Preview Table */}
              <div style={{ maxHeight: 220, overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                <Table
                  size="small"
                  dataSource={parsedImportData.rows.slice(0, 10)}
                  rowKey="id"
                  pagination={false}
                  columns={[
                    { title: "Month", dataIndex: "monthName", key: "monthName", width: 130 },
                    { title: "Officer", dataIndex: "salesOfficer", key: "salesOfficer", width: 80 },
                    { title: "Buyer / Customer", dataIndex: "buyer", key: "buyer" },
                    { title: "Dept", dataIndex: "department", key: "department", width: 100 },
                    { title: "Budg TEU", dataIndex: "budgetTeu", key: "budgetTeu", width: 90, render: val => (val || 0).toFixed(1) },
                    { title: "Budg TO", dataIndex: "budgetTurnover", key: "budgetTurnover", width: 110, render: val => formatCompactCurrency(val) },
                    { title: "Act TEU", dataIndex: "actualTeu", key: "actualTeu", width: 90, render: val => (val || 0).toFixed(1) }
                  ]}
                />
              </div>
              {parsedImportData.rows.length > 10 && (
                <Text type="secondary" style={{ fontSize: 11, marginTop: 4, display: "block" }}>
                  Showing first 10 of {parsedImportData.rows.length} records.
                </Text>
              )}
            </div>
          )}
        </div>
      </Modal>

      {/* Modal for Adding New Entry */}
      <Modal
        title={
          <Space>
            <FundProjectionScreenOutlined style={{ color: "#3b82f6" }} />
            <span>Add New Production Forecast Entry</span>
          </Space>
        }
        open={isModalVisible}
        onOk={handleModalSubmit}
        onCancel={() => setIsModalVisible(false)}
        width={700}
        okText="Add to Forecast"
        cancelText="Cancel"
      >
        <Form
          form={form}
          layout="vertical"
          onValuesChange={calculateModalPreview}
          style={{ marginTop: 16 }}
        >
          <Row gutter={16}>
            <Col span={12}>
              <Form.Item 
                name="monthKey" 
                label="Target Month & Year" 
                rules={[{ required: true, message: "Please select target month" }]}
              >
                <Select size="middle">
                  {FINANCIAL_YEAR_MONTHS.map(m => (
                    <Option key={m.monthKey} value={m.monthKey}>{m.name} {m.defaultYear}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item 
                name="salesOfficer" 
                label="Sales Officer" 
                rules={[{ required: true }]}
              >
                <Select size="middle" onChange={(val) => form.setFieldsValue({ department: getDepartmentForOfficer(val) })}>
                  {SALES_OFFICERS.map(s => (
                    <Option key={s.code} value={s.code}>{s.code}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>

            <Col span={6}>
              <Form.Item 
                name="department" 
                label="Department"
              >
                <Select size="middle">
                  {DEPARTMENTS.map(d => (
                    <Option key={d} value={d}>{d}</Option>
                  ))}
                </Select>
              </Form.Item>
            </Col>
          </Row>

          <Form.Item 
            name="buyer" 
            label="Buyer / Customer Name" 
            rules={[{ required: true, message: "Please enter customer or company name" }]}
          >
            <Input placeholder="e.g. PRIDE GARDEN PRODUCTS" size="middle" />
          </Form.Item>

          <Divider orientation="left" style={{ margin: "12px 0", fontSize: 13, color: "#1e40af" }}>
            Initial Budget Target
          </Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="budgetTeu" label="Budget TEU Qty">
                <InputNumber min={0} step={0.25} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="budgetTurnover" label="Budget TO-FOB (LKR)">
                <InputNumber min={0} step={100000} style={{ width: "100%" }} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="budgetContribution" label="Budget Contribution (LKR)">
                <InputNumber min={0} step={50000} style={{ width: "100%" }} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: "12px 0", fontSize: 13, color: "#5b21b6" }}>
            Actual Performance
          </Divider>

          <Row gutter={16}>
            <Col span={8}>
              <Form.Item name="actualTeu" label="Actual TEU Qty">
                <InputNumber min={0} step={0.25} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actualTurnover" label="Actual TO-FOB (LKR)">
                <InputNumber min={0} step={100000} style={{ width: "100%" }} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
            <Col span={8}>
              <Form.Item name="actualContribution" label="Actual Contribution (LKR)">
                <InputNumber min={0} step={50000} style={{ width: "100%" }} formatter={val => `${val}`.replace(/\B(?=(\d{3})+(?!\d))/g, ',')} />
              </Form.Item>
            </Col>
          </Row>

          <Divider orientation="left" style={{ margin: "12px 0", fontSize: 13, color: "#0f766e" }}>
            Factory Performance (Proportional Ratio)
          </Divider>

          <Row gutter={16}>
            <Col span={12}>
              <Form.Item name="factoryTeu" label="Factory Capable TEU">
                <InputNumber min={0} step={0.25} style={{ width: "100%" }} />
              </Form.Item>
            </Col>
            <Col span={12}>
              <Form.Item name="notes" label="Notes / Remarks">
                <Input placeholder="Factory confirmation notes..." />
              </Form.Item>
            </Col>
          </Row>

          {modalPreview && (
            <Card size="small" style={{ background: "#f8fafc", borderRadius: 8, marginTop: 8 }}>
              <Row gutter={16} align="middle">
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Calculated Status:</Text>
                  <div>
                    {modalPreview.status === "met" && <Tag color="success">✓ MET TARGET</Tag>}
                    {modalPreview.status === "new" && <Tag color="processing">★ NEW BUYER</Tag>}
                    {modalPreview.status === "variance" && <Tag color="error">⚠ VARIANCE</Tag>}
                    {modalPreview.status === "pending" && <Tag>PENDING</Tag>}
                  </div>
                </Col>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Achievement Rate:</Text>
                  <div style={{ fontWeight: 700, color: modalPreview.achievementRate >= 100 ? "#10b981" : "#334155" }}>
                    {modalPreview.achievementRate}%
                  </div>
                </Col>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Factory TO (Ratio):</Text>
                  <div style={{ fontWeight: 700, color: "#0f766e" }}>
                    {formatCompactCurrency(modalPreview.factoryTurnover)} LKR
                  </div>
                </Col>
                <Col span={6}>
                  <Text type="secondary" style={{ fontSize: 11 }}>Budget Margin:</Text>
                  <div style={{ fontWeight: 700, color: "#3b82f6" }}>
                    {formatPercentage(modalPreview.budgetMargin)}
                  </div>
                </Col>
              </Row>
            </Card>
          )}
        </Form>
      </Modal>
    </div>
  );
}
